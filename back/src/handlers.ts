import { DynamoDBClient, ScanCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { z } from "zod";
import config from "./credentials";
import { Request, Response } from "express";

const queueUrl =
  "https://sqs.us-east-2.amazonaws.com/590184061505/payments-queue";

const handlePaymentRequest = async (request: Request, response: Response) => {
  const createPayloadSchema = z.array(
    z.object({
      idempotencyKey: z.string(),
      type: z.enum(["credit", "debit"]),
      amount: z.number(),
    })
  );

  const sqsClient = new SQSClient(config);

  const payloads = createPayloadSchema.parse(request.body);

  try {
    for (const payload of payloads) {
      const command = new SendMessageCommand({
        MessageBody: JSON.stringify(payload),
        QueueUrl: queueUrl,
      });
      await sqsClient.send(command);
    }

    return response.status(200).json({ message: "Payments requested" });
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
};

const handlePaymentRetrieval = async (_: Request, response: Response) => {
  const dbClient = new DynamoDBClient(config);

  const params = {
    TableName: "payments",
  };

  try {
    const { Items = [] } = await dbClient.send(new ScanCommand(params));
    const formattedItems = Items.map((item) => ({
      id: item.id.S,
      type: item.type.S,
      amount: parseFloat(item.amount.N!),
    }));

    return response.status(200).json({ data: formattedItems });
  } catch (error) {
    console.error("An unexpected error occurred:", error);
    return response.status(500).json({ error: "Internal Server Error" });
  }
};

export { handlePaymentRequest, handlePaymentRetrieval };
