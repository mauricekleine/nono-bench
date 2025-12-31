import { openrouter, type OpenRouterCompletionSettings } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

export const RERUN_THRESHOLD_DAYS = 30;

const defaultProviderOptions: OpenRouterCompletionSettings = {
	usage: {
		include: true,
	},
};

export type Model = {
	llm: LanguageModel;
	name: string;
};

export const MODELS: Model[] = [
	{
		llm: openrouter("allenai/olmo-3.1-32b-think:free", defaultProviderOptions),
		name: "olmo-3.1-32b-think",
	},
	{
		llm: openrouter("anthropic/claude-opus-4.5", defaultProviderOptions),
		name: "claude-4.5-opus",
	},
  {
    llm: openrouter("anthropic/claude-opus-4.5", {
      ...defaultProviderOptions,
      reasoning: { effort: "high", exclude: true },
    }),
    name: "claude-4.5-opus-thinking-high",
  },
	{
		llm: openrouter("anthropic/claude-sonnet-4.5", defaultProviderOptions),
		name: "claude-4.5-sonnet",
	},
	{
		llm: openrouter("bytedance-seed/seed-1.6-flash", defaultProviderOptions),
		name: "seed-1.6-flash",
	},
	{
		llm: openrouter("deepseek/deepseek-v3.2", defaultProviderOptions),
		name: "deepseek-v3.2",
	},
	{
		llm: openrouter("google/gemini-3-flash-preview", defaultProviderOptions),
		name: "gemini-3-flash-preview",
	},
	{
		llm: openrouter("google/gemini-3-pro-preview", defaultProviderOptions),
		name: "gemini-3-pro-preview",
	},
	{
		llm: openrouter("mistralai/ministral-14b-2512", defaultProviderOptions),
		name: "ministral-14b-2512",
	},
	{
		llm: openrouter("mistralai/mistral-large-2512", defaultProviderOptions),
		name: "mistral-large-2512",
	},
	{
		llm: openrouter("moonshotai/kimi-k2-0905", defaultProviderOptions),
		name: "kimi-k2",
	},
	{
		llm: openrouter("moonshotai/kimi-k2-thinking", defaultProviderOptions),
		name: "kimi-k2-thinking",
	},
	{
		llm: openrouter("minimax/minimax-m2.1", defaultProviderOptions),
		name: "minimax-m2.1",
	},
	{
		llm: openrouter("openai/gpt-5.2", defaultProviderOptions),
		name: "gpt-5.2",
	},
	{
		llm: openrouter("openai/gpt-5.2", {
			...defaultProviderOptions,
			reasoning: {
				effort: "high",
				exclude: true,
			},
		}),
		name: "gpt-5.2-high",
	},
	{
		llm: openrouter("openai/gpt-5.2", {
			...defaultProviderOptions,
			reasoning: {
        // @ts-expect-error - xhigh is valid but not typed
				effort: "xhigh",
				exclude: true,
			},
		}),
		name: "gpt-5.2-xhigh",
	},
	{
		llm: openrouter("openai/gpt-5.2-pro", defaultProviderOptions),
		name: "gpt-5.2-pro",
	},
	{
		name: "gpt-5.2-pro-high",
		llm: openrouter("openai/gpt-5.2-pro", {
			...defaultProviderOptions,
			reasoning: {
				effort: "high",
				exclude: true,
			},
		}),
	},
	{
		llm: openrouter("openai/gpt-oss-120b", defaultProviderOptions),
		name: "gpt-oss-120b",
	},
	{
		llm: openrouter("z-ai/glm-4.7", defaultProviderOptions),
		name: "glm-4.7",
	},
	{
		llm: openrouter("x-ai/grok-4", defaultProviderOptions),
		name: "grok-4",
	},
	{
		llm: openrouter("x-ai/grok-4.1-fast", defaultProviderOptions),
		name: "grok-4.1-fast",
	},
	{
		llm: openrouter("xiaomi/mimo-v2-flash:free", defaultProviderOptions),
		name: "mimo-v2-flash",
	},
];