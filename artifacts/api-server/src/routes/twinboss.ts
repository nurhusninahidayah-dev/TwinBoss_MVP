import { and, asc, desc, eq, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  AnalyzeRequestParams,
  AnalyzeRequestResponse,
  CreateRequestBody,
  CreateRequestResponse,
  DecideRequestBody,
  DecideRequestParams,
  DecideRequestResponse,
  GetActivityResponse,
  GetCustomersResponse,
  GetDashboardSummaryResponse,
  GetRequestParams,
  GetRequestResponse,
  GetRequestsQueryParams,
  GetRequestsResponse,
  GetRulesResponse,
  GenerateCustomerMessageParams,
  GenerateCustomerMessageResponse,
} from "@workspace/api-zod";
import {
  activityTable,
  customersTable,
  db,
  receiptsTable,
  requestsTable,
  rulesTable,
} from "@workspace/db";
import type {
  DecisionAction,
  RequestAlternative,
  RequestType,
} from "@workspace/db";
import { getGroqCustomerMessage, getGroqRecommendation } from "../lib/groq";

const router: IRouter = Router();

async function findRequestDetail(id: number) {
  const [row] = await db
    .select({ request: requestsTable, customer: customersTable })
    .from(requestsTable)
    .innerJoin(customersTable, eq(requestsTable.customerId, customersTable.id))
    .where(eq(requestsTable.id, id))
    .limit(1);

  if (!row) return undefined;

  const { request, customer } = row;
  return {
    id: request.id,
    type: request.type,
    title: request.title,
    amount: request.amount,
    staffName: request.staffName,
    customerName: customer.name,
    customerTier: customer.tier,
    submittedAt: request.createdAt,
    status: request.status,
    riskLevel: request.riskLevel,
    recommendation: request.recommendation,
    confidence: request.confidence,
    description: request.description,
    customerLifetimeValue: customer.lifetimeValue,
    staffRole: request.staffRole,
    matchedRule: request.matchedRule,
    recommendationExplanation: request.recommendationExplanation,
    alternatives: request.alternatives,
    recommendationSource: request.recommendationSource,
    decidedAction: request.decidedAction,
    decisionReason: request.decisionReason,
  };
}

function getRiskLevel(type: RequestType, amount: number, tier: string) {
  if (amount >= 500 || (type === "refund" && amount >= 200)) return "high";
  if (tier === "VIP" && amount <= 200) return "low";
  return "medium";
}

function learningCorrection(type: RequestType, reason: string) {
  if (/(photo|evidence|proof)/i.test(reason)) {
    return `For ${type} requests involving damaged or faulty goods, require photo evidence before recommending a cash refund.`;
  }
  if (/(cash flow|cashflow|liquidity)/i.test(reason)) {
    return `When cash-flow protection is the stated priority for ${type} requests, consider store credit before a cash refund where policy allows.`;
  }
  return `For future ${type} requests, consider the owner's correction: “${reason}”. Check it against the other active business rules.`;
}

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const requests = (await db.select().from(requestsTable)).filter(
    (request) => request.type === "refund",
  );
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const handledToday = requests.filter(
    (request) =>
      request.decidedAt &&
      request.decidedAt.getTime() >= startOfDay.getTime(),
  );
  const responseMinutes = handledToday
    .filter((request) => request.decidedAt)
    .map((request) =>
      Math.max(
        1,
        Math.round(
          (request.decidedAt!.getTime() - request.createdAt.getTime()) / 60_000,
        ),
      ),
    );

  const summary = {
    waitingForDecision: requests.filter((request) => request.status === "pending").length,
    handledToday: handledToday.length,
    averageResponseMinutes: responseMinutes.length
      ? Math.round(responseMinutes.reduce((sum, value) => sum + value, 0) / responseMinutes.length)
      : 0,
    timeSavedMinutes: handledToday.length * 8,
  };

  req.log.info({ waitingForDecision: summary.waitingForDecision }, "Loaded TwinBoss dashboard summary");
  res.json(GetDashboardSummaryResponse.parse(summary));
});

router.get("/requests", async (req, res): Promise<void> => {
  const query = GetRequestsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const rows = await db
    .select({ request: requestsTable, customer: customersTable })
    .from(requestsTable)
    .innerJoin(customersTable, eq(requestsTable.customerId, customersTable.id))
    .where(
      query.data.status
        ? eq(requestsTable.status, query.data.status)
        : undefined,
    )
    .orderBy(desc(requestsTable.createdAt), asc(requestsTable.id));

  const requests = rows.map(({ request, customer }) => ({
    id: request.id,
    type: request.type,
    title: request.title,
    amount: request.amount,
    staffName: request.staffName,
    customerName: customer.name,
    customerTier: customer.tier,
    submittedAt: request.createdAt,
    status: request.status,
    riskLevel: request.riskLevel,
    recommendation: request.recommendation,
    confidence: request.confidence,
  }));

  res.json(GetRequestsResponse.parse(requests));
});

router.get("/requests/:id", async (req, res): Promise<void> => {
  const params = GetRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const detail = await findRequestDetail(params.data.id);
  if (!detail) {
    res.status(404).json({ error: "Request not found" });
    return;
  }

  res.json(GetRequestResponse.parse(detail));
});

router.post("/requests", async (req, res): Promise<void> => {
  const parsed = CreateRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const customerName = parsed.data.customerName.trim();
  const normalizedName = customerName.toLocaleLowerCase();
  const [existingCustomer] = await db
    .select()
    .from(customersTable)
    .where(sql`lower(${customersTable.name}) = ${normalizedName}`)
    .limit(1);

  let customer = existingCustomer;
  if (!customer) {
    const [createdCustomer] = await db
      .insert(customersTable)
      .values({
        name: customerName,
        tier: "Standard",
        lifetimeValue: 0,
        orders: 0,
        notes: "New customer record created from a staff request.",
      })
      .returning();
    customer = createdCustomer;
  }

  const requestType = parsed.data.type as RequestType;
  const riskLevel = getRiskLevel(requestType, parsed.data.amount, customer.tier);
  const [request] = await db
    .insert(requestsTable)
    .values({
      type: requestType,
      title: parsed.data.title.trim(),
      amount: parsed.data.amount,
      description: parsed.data.description.trim(),
      staffName: parsed.data.staffName.trim(),
      customerId: customer.id,
      riskLevel,
      status: "pending",
    })
    .returning();

  await db.insert(activityTable).values({
    kind: "request_submitted",
    title: "New request submitted",
    description: `${request.title} for ${customer.name} is waiting for a boss decision.`,
    actor: request.staffName,
    requestId: request.id,
    amount: request.amount,
  });

  const detail = await findRequestDetail(request.id);
  req.log.info({ requestId: request.id, customerId: customer.id }, "Staff request submitted");
  res.status(201).json(CreateRequestResponse.parse(detail));
});

router.post("/requests/:id/recommendation", async (req, res): Promise<void> => {
  const params = AnalyzeRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [row] = await db
    .select({ request: requestsTable, customer: customersTable })
    .from(requestsTable)
    .innerJoin(customersTable, eq(requestsTable.customerId, customersTable.id))
    .where(eq(requestsTable.id, params.data.id))
    .limit(1);

  if (!row) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (row.request.status !== "pending") {
    res.status(409).json({ error: "Only pending requests can be analyzed." });
    return;
  }

  const rules = await db
    .select()
    .from(rulesTable)
    .where(eq(rulesTable.enabled, true))
    .orderBy(asc(rulesTable.createdAt));

  try {
    const recommendation = await getGroqRecommendation(
      row.request,
      row.customer,
      rules,
    );
    const [updated] = await db
      .update(requestsTable)
      .set({
        recommendation: recommendation.recommendation,
        confidence: recommendation.confidence,
        recommendationExplanation: recommendation.explanation,
        matchedRule: recommendation.matchedRule,
        alternatives: recommendation.alternatives as RequestAlternative[],
        recommendationSource: "Groq · GPT-OSS 120B",
      })
      .where(eq(requestsTable.id, row.request.id))
      .returning();

    await db.insert(activityTable).values({
      kind: "recommendation_generated",
      title: "TwinBoss prepared a recommendation",
      description: `${recommendation.recommendation.replace("_", " ")} · ${recommendation.confidence}% confidence`,
      actor: "TwinBoss AI",
      requestId: updated.id,
      amount: updated.amount,
      action: recommendation.recommendation,
    });

    const detail = await findRequestDetail(updated.id);
    req.log.info({ requestId: updated.id, confidence: recommendation.confidence }, "Groq recommendation generated");
    res.json(AnalyzeRequestResponse.parse(detail));
  } catch (error) {
    req.log.error({ err: error, requestId: row.request.id }, "Groq recommendation failed");
    res.status(502).json({
      error: "TwinBoss could not get a valid recommendation from Groq. Check the Groq API key and try again.",
    });
  }
});

router.post("/requests/:id/decision", async (req, res): Promise<void> => {
  const params = DecideRequestParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const parsed = DecideRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const detail = await findRequestDetail(params.data.id);
  if (!detail) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (detail.status !== "pending") {
    res.status(409).json({ error: "This request already has a final decision." });
    return;
  }
  if (!detail.recommendation) {
    res.status(400).json({ error: "Generate a TwinBoss recommendation before recording a decision." });
    return;
  }

  const action = parsed.data.action as DecisionAction;
  const reason = parsed.data.reason?.trim() || null;
  const isOverride = action !== detail.recommendation;
  if (isOverride && !reason) {
    res.status(400).json({ error: "Add a reason when changing TwinBoss's recommendation." });
    return;
  }

  const decidedAt = new Date();
  const learningNote = isOverride
    ? learningCorrection(detail.type as RequestType, reason!)
    : null;
  const receiptNumber = `TB-${decidedAt.toISOString().slice(0, 10).replaceAll("-", "")}-${String(detail.id).padStart(4, "0")}`;

  const receipt = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(requestsTable)
      .set({
        status: action === "reject" ? "rejected" : "approved",
        decidedAction: action,
        decisionReason: reason,
        decidedAt,
      })
      .where(
        and(
          eq(requestsTable.id, detail.id),
          eq(requestsTable.status, "pending"),
        ),
      )
      .returning();

    if (!updated) return null;

    const [createdReceipt] = await tx
      .insert(receiptsTable)
      .values({
        requestId: detail.id,
        receiptNumber,
        requestedAmount: detail.amount,
        requestedAction: detail.recommendation,
        chosenAction: action,
        reason,
        ruleApplied: detail.matchedRule,
        decisionBy: "Boss",
        decidedAt,
        syncStatus: "Synced to Orbyte Hub (demo)",
        learningNote,
      })
      .returning();

    await tx.insert(activityTable).values({
      kind: "decision_recorded",
      title: `Request ${action === "reject" ? "rejected" : action === "store_credit" ? "converted to store credit" : "approved"}`,
      description: `${detail.title} for ${detail.customerName} · RM${detail.amount.toFixed(2)}`,
      actor: "Boss",
      requestId: detail.id,
      amount: detail.amount,
      action,
    });

    if (learningNote && reason) {
      await tx.insert(rulesTable).values({
        title: `Owner correction · ${detail.type}`,
        description: learningNote,
        enabled: true,
        source: "learned",
      });
      await tx.insert(activityTable).values({
        kind: "learning_updated",
        title: "TwinBoss learned from an override",
        description: learningNote,
        actor: "TwinBoss",
        requestId: detail.id,
        amount: detail.amount,
        action,
      });
    }

    return createdReceipt;
  });

  if (!receipt) {
    res.status(409).json({ error: "This request was decided by someone else. Refresh the queue." });
    return;
  }

  const response = {
    id: receipt.id,
    requestId: detail.id,
    receiptNumber: receipt.receiptNumber,
    requestTitle: detail.title,
    customerName: detail.customerName,
    staffName: detail.staffName,
    requestedAmount: receipt.requestedAmount,
    requestedAction: receipt.requestedAction,
    chosenAction: receipt.chosenAction,
    reason: receipt.reason,
    ruleApplied: receipt.ruleApplied,
    decisionBy: receipt.decisionBy,
    decidedAt: receipt.decidedAt,
    syncStatus: receipt.syncStatus,
    learningNote: receipt.learningNote,
  };
  req.log.info({ requestId: detail.id, action }, "Boss decision recorded");
  res.status(201).json(DecideRequestResponse.parse(response));
});

router.post("/requests/:id/message-draft", async (req, res): Promise<void> => {
  const params = GenerateCustomerMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const detail = await findRequestDetail(params.data.id);
  if (!detail) {
    res.status(404).json({ error: "Request not found" });
    return;
  }
  if (!detail.decidedAction) {
    res.status(409).json({ error: "Record an owner decision before drafting a customer update." });
    return;
  }

  try {
    const draft = await getGroqCustomerMessage({
      customerName: detail.customerName,
      requestTitle: detail.title,
      amount: detail.amount,
      action: detail.decidedAction.replace("_", " "),
      reason: detail.decisionReason,
    });
    res.json(GenerateCustomerMessageResponse.parse({ draft }));
  } catch (error) {
    req.log.error({ err: error, requestId: detail.id }, "Customer WhatsApp draft generation failed");
    res.status(502).json({ error: "TwinBoss could not draft the customer update. Try again." });
  }
});

router.get("/customers", async (_req, res): Promise<void> => {
  const customers = await db
    .select()
    .from(customersTable)
    .orderBy(asc(customersTable.name));
  res.json(GetCustomersResponse.parse(customers));
});

router.get("/rules", async (_req, res): Promise<void> => {
  const rules = await db
    .select()
    .from(rulesTable)
    .orderBy(desc(rulesTable.createdAt));
  res.json(GetRulesResponse.parse(rules));
});

router.get("/activity", async (_req, res): Promise<void> => {
  const rows = await db
    .select({
      activity: activityTable,
      receipt: receiptsTable,
      request: requestsTable,
      customer: customersTable,
    })
    .from(activityTable)
    .leftJoin(receiptsTable, eq(receiptsTable.requestId, activityTable.requestId))
    .leftJoin(requestsTable, eq(requestsTable.id, activityTable.requestId))
    .leftJoin(customersTable, eq(customersTable.id, requestsTable.customerId))
    .orderBy(desc(activityTable.createdAt))
    .limit(40);

  const activity = rows.map(({ activity: item, receipt, request, customer }) => {
    const hasReceipt = item.kind === "decision_recorded" && receipt;
    return {
      id: item.id,
      kind: item.kind,
      title: item.title,
      description: item.description,
      actor: item.actor,
      createdAt: item.createdAt,
      requestId: item.requestId,
      amount: item.amount ?? null,
      action: item.action ?? null,
      receiptNumber: hasReceipt ? receipt.receiptNumber : null,
      requestTitle: hasReceipt ? request?.title ?? null : null,
      customerName: hasReceipt ? customer?.name ?? null : null,
      staffName: hasReceipt ? request?.staffName ?? null : null,
      requestedAction: hasReceipt ? receipt.requestedAction : null,
      reason: hasReceipt ? receipt.reason : null,
      ruleApplied: hasReceipt ? receipt.ruleApplied : null,
      decisionBy: hasReceipt ? receipt.decisionBy : null,
      syncStatus: hasReceipt ? receipt.syncStatus : null,
      learningNote: hasReceipt ? receipt.learningNote : null,
    };
  });

  res.json(GetActivityResponse.parse(activity));
});

export default router;
