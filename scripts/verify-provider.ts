import { loadAppConfig } from "../src/main/config";
import { ModelService } from "../src/main/ai";

const printUsage = () => {
  console.log("Usage: node --loader tsx scripts/verify-provider.ts <modelId> <message>");
  console.log("Example: node --loader tsx scripts/verify-provider.ts openai:gpt-4.1-mini \"hello\"");
};

const run = async () => {
  const [, , modelId, ...messageParts] = process.argv;
  const message = messageParts.join(" ").trim();

  if (!modelId || !message) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const config = loadAppConfig();
  const service = new ModelService(config);

  const stream = service.chat({
    modelId,
    messages: [{ role: "user", content: message }]
  });

  for await (const event of stream) {
    if (event.type === "content_delta") {
      process.stdout.write(event.delta);
      continue;
    }

    if (event.type === "tool_call") {
      process.stdout.write(`\n[tool_call] ${event.toolCall.name} ${JSON.stringify(event.toolCall.arguments)}\n`);
      continue;
    }

    if (event.type === "error") {
      process.stderr.write(`\n[error] ${event.error}\n`);
      process.exitCode = 1;
      return;
    }

    if (event.type === "finish") {
      process.stdout.write(`\n\n[finish] reason=${event.reason} usage=${JSON.stringify(event.usage ?? {})}\n`);
    }
  }
};

void run();
