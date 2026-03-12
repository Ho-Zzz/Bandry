import { BotIcon } from "lucide-react";

export const ThreadWelcome = () => {
  return (
    <div className="mx-auto my-auto flex w-full max-w-[48rem] flex-grow flex-col items-center justify-center text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <BotIcon size={28} />
      </div>
      <h2 className="text-2xl font-semibold text-zinc-900">How can I help you today?</h2>
      <p className="mt-2 max-w-md text-sm text-zinc-500">
        Describe what you want to accomplish and I&apos;ll plan, execute and summarize the result.
      </p>
    </div>
  );
};
