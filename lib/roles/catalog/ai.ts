/**
 * The AI and machine learning slice of the role catalogue.
 *
 * WHY THIS IS ITS OWN TOP-LEVEL CATEGORY
 *
 * The obvious alternative is to fold these roles into a "Data & Analytics"
 * bucket alongside analysts and data engineers, on the reasoning that they all
 * work with data. That reasoning was true in about 2018 and is not true now. An
 * LLM application engineer and a BI analyst share almost no interview surface:
 * one is asked about retrieval quality, context windows, evaluation harnesses
 * and cost per request, the other about warehouse modelling and SQL. Grouping
 * them means the category `focus` -- the text that actually steers the
 * interviewer's questions -- has to be written vaguely enough to cover both,
 * and a vague focus produces a generic interview, which is the one failure mode
 * this product cannot afford.
 *
 * Three further reasons, in rough order of how much they cost us to get wrong:
 *
 * 1. This is the fastest-moving part of the hiring market. Roles appear here
 *    faster than in any other category, so the file that holds them needs to be
 *    editable on its own, without a reviewer having to reason about whether a
 *    change also affects analysts.
 *
 * 2. The titles are genuinely unstable. "GenAI Engineer", "Generative AI
 *    Engineer", "LLM Engineer" and "AI Engineer" are, at a great many
 *    companies, the same job advertised under four names in the same year -- and
 *    at other companies they are four different jobs. We cannot arbitrate that,
 *    so we list all four and let aliases pull the near-misses together.
 *
 * 3. Buried roles are undiscoverable roles. Someone opening the picker to
 *    practise for an AI job scans the tab strip first. If there is no AI tab
 *    they conclude the product does not cover AI and leave, regardless of what
 *    is nested three levels down inside "Data".
 *
 * WHY ALIASES CARRY THE SEARCH LOAD
 *
 * Nobody types the full job title. They type "ML", "GenAI", "RAG", "NLP",
 * "CV", "LLM" -- abbreviations that, with the exception of LLM, do not appear
 * anywhere in the names below. Name matching alone therefore returns nothing
 * for the queries people most often issue, and an empty result set reads as an
 * empty catalogue. So `aliases` is not decoration on this file; it is the index.
 * Every family below carries its abbreviation, its spelled-out form, and the
 * common alternative titles for the same job, and every entry carries "AI"
 * somewhere in the name or the aliases so that the bare query "AI" surfaces the
 * whole category.
 *
 * The one discipline that matters: aliases must be things a real person would
 * actually type. Padding the arrays with plausible-looking noise makes every
 * query match everything, which is the same as matching nothing.
 *
 * Pure data. No imports beyond the type, no runtime logic -- searching, ranking
 * and grouping all live with the consumer.
 */

import type { Role } from "@/lib/roles/types";

export const AI_ROLES: Role[] = [
  // ---------------------------------------------------------------------------
  // AI Engineering
  //
  // The generalist end of the category: people who build applications on top of
  // models rather than training them. These titles are the least standardised of
  // the lot, which is why there are ten of them -- they are mostly the same job,
  // and we would rather list the variants than guess which one a given company
  // has settled on.
  // ---------------------------------------------------------------------------
  {
    id: "artificial-intelligence-engineer",
    name: "Artificial Intelligence Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: ["AI", "AI Engineer", "Artificial Intelligence", "AI Developer"],
    description:
      "Builds and ships production software whose core behaviour comes from AI models rather than hand-written rules.",
  },
  {
    id: "ai-engineer",
    name: "AI Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: [
      "AI",
      "Artificial Intelligence Engineer",
      "AI Developer",
      "GenAI Engineer",
      "LLM Engineer",
    ],
    description:
      "Turns foundation models into working product features, owning the prompts, the retrieval, the evaluation and the cost per request.",
    suggested: true,
    popular: true,
  },
  {
    id: "ai-developer",
    name: "AI Developer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: ["AI", "AI Engineer", "Artificial Intelligence Developer", "AI Programmer"],
    description:
      "Writes the application code around AI models -- API calls, tool definitions, streaming responses and the fallbacks for when the model misbehaves.",
    popular: true,
  },
  {
    id: "applied-ai-engineer",
    name: "Applied AI Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: ["Applied AI", "AI Engineer", "Machine Learning Engineer", "GenAI"],
    description:
      "Applies existing AI models to concrete product and operational problems, validating that the resulting system improves a real outcome.",
  },
  {
    id: "ai-software-engineer",
    name: "AI Software Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: ["AI", "AI Engineer", "Software Engineer AI", "AI SWE"],
    description:
      "A software engineer whose product happens to be AI-backed, held to the normal engineering bar of testing, review and reliability.",
  },
  {
    id: "ai-solutions-engineer",
    name: "AI Solutions Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: ["AI", "Solutions Engineer", "AI Sales Engineer", "AI Pre-Sales Engineer"],
    description:
      "Sits between customers and the platform, scoping what AI can realistically do for a given account and building the proof that it does.",
  },
  {
    id: "ai-application-engineer",
    name: "AI Application Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: ["AI", "AI App Engineer", "AI Application Developer", "LLM Application Engineer"],
    description:
      "Owns a single AI-powered application end to end, from the user-facing interface down to the model calls behind it.",
  },
  {
    id: "ai-product-engineer",
    name: "AI Product Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: ["AI", "Product Engineer", "AI Engineer", "GenAI Product Engineer"],
    description:
      "Works close to users, shipping AI features and iterating on them against real usage rather than benchmark scores.",
  },
  {
    id: "ai-integration-engineer",
    name: "AI Integration Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: ["AI", "AI Engineer", "AI Systems Integration", "LLM Integration Engineer"],
    description:
      "Wires AI capability into systems that already exist, dealing with legacy APIs, awkward data formats and the permissions model nobody wants to touch.",
  },
  {
    id: "ai-systems-engineer",
    name: "AI Systems Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: ["AI", "AI Engineer", "AI Platform Engineer", "ML Systems Engineer"],
    description:
      "Designs the whole system an AI feature lives in -- queues, caches, timeouts and the behaviour when the model provider goes down.",
  },
  {
    id: "ai-automation-engineer",
    name: "AI Automation Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Engineering",
    aliases: [
      "AI",
      "Automation Engineer",
      "AI Workflow Engineer",
      "Intelligent Automation Engineer",
    ],
    description:
      "Replaces manual internal processes with AI-driven pipelines, and is judged on how rarely a human has to step back in.",
  },

  // ---------------------------------------------------------------------------
  // Machine Learning
  //
  // The classical discipline: training, evaluating and operating models on your
  // own data. Distinct from Generative AI below, and the distinction matters at
  // interview -- an ML engineer is asked about feature pipelines, drift and
  // offline/online skew, none of which come up when you are calling someone
  // else's model over HTTP.
  //
  // Every entry here carries "ML" and "Machine Learning", because "ML" is the
  // single most common query in this whole category and appears in almost none
  // of the names.
  // ---------------------------------------------------------------------------
  {
    id: "machine-learning-engineer",
    name: "Machine Learning Engineer",
    categoryId: "ai-ml",
    subcategory: "Machine Learning",
    aliases: [
      "ML",
      "Machine Learning",
      "ML Engineer",
      "ML Developer",
      "Applied ML Engineer",
      "AI",
    ],
    description:
      "Takes models from notebook to production: training pipelines, serving, monitoring and the retraining loop that keeps them honest.",
    suggested: true,
    popular: true,
  },
  {
    id: "machine-learning-developer",
    name: "Machine Learning Developer",
    categoryId: "ai-ml",
    subcategory: "Machine Learning",
    aliases: ["ML", "Machine Learning", "ML Developer", "ML Programmer", "AI"],
    description:
      "Implements and tunes models against a defined problem, spending most of the time on features and data quality rather than on architecture.",
  },
  {
    id: "ml-engineer",
    name: "ML Engineer",
    categoryId: "ai-ml",
    subcategory: "Machine Learning",
    aliases: [
      "ML",
      "Machine Learning",
      "Machine Learning Engineer",
      "Applied ML Engineer",
      "AI",
    ],
    description:
      "The short-form title for the same job as Machine Learning Engineer, common in startup and US postings.",
    popular: true,
  },
  {
    id: "deep-learning-engineer",
    name: "Deep Learning Engineer",
    categoryId: "ai-ml",
    subcategory: "Machine Learning",
    aliases: [
      "DL",
      "Deep Learning",
      "ML",
      "Machine Learning",
      "Neural Network Engineer",
      "AI",
    ],
    description:
      "Designs and trains neural networks, and is expected to reason about architecture choices, loss functions and what a training curve is telling them.",
    popular: true,
  },
  {
    id: "mlops-engineer",
    name: "MLOps Engineer",
    categoryId: "ai-ml",
    subcategory: "Machine Learning",
    aliases: [
      "MLOps",
      "ML Ops",
      "ML",
      "Machine Learning",
      "ML Platform Engineer",
      "ML Infrastructure Engineer",
      "AI",
    ],
    description:
      "Owns the machinery around models rather than the models themselves: experiment tracking, model registries, reproducible training and safe rollout.",
    popular: true,
  },
  {
    id: "applied-scientist",
    name: "Applied Scientist",
    categoryId: "ai-ml",
    subcategory: "Machine Learning",
    aliases: [
      "ML",
      "Machine Learning",
      "Applied ML Scientist",
      "Applied Machine Learning Scientist",
      "Research Scientist",
      "AI",
    ],
    description:
      "Applies published research to a concrete business problem, and is judged on the measured lift rather than on novelty.",
  },
  {
    id: "machine-learning-researcher",
    name: "Machine Learning Researcher",
    categoryId: "ai-ml",
    subcategory: "Machine Learning",
    aliases: [
      "ML",
      "Machine Learning",
      "ML Researcher",
      "ML Research Scientist",
      "AI Researcher",
      "AI",
    ],
    description:
      "Investigates new methods, runs the experiments that test them, and publishes or hands the result to an engineering team.",
  },
  {
    id: "recommendation-systems-engineer",
    name: "Recommendation Systems Engineer",
    categoryId: "ai-ml",
    subcategory: "Machine Learning",
    aliases: [
      "ML",
      "Machine Learning",
      "RecSys",
      "Recommender Systems Engineer",
      "Personalisation Engineer",
      "Ranking Engineer",
      "AI",
    ],
    description:
      "Builds ranking and personalisation systems, balancing offline metrics against what actually moves engagement in an A/B test.",
  },

  // ---------------------------------------------------------------------------
  // Generative AI
  //
  // The naming problem in miniature. "GenAI", "Gen AI" and "Generative AI" are
  // typed in roughly equal proportion, and someone searching one form will not
  // find the others, so every entry in this block carries all three. LLM-specific
  // titles additionally carry "LLM" and "Large Language Model" -- and "GenAI"
  // too, because plenty of people use the terms interchangeably when searching
  // even where a recruiter would not.
  // ---------------------------------------------------------------------------
  {
    id: "generative-ai-engineer",
    name: "Generative AI Engineer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "GenAI",
      "Gen AI",
      "Generative AI",
      "GenAI Engineer",
      "LLM Engineer",
      "AI",
    ],
    description:
      "Builds features on top of generative models -- text, image or audio -- and owns the prompt, context and output-quality layers around them.",
    suggested: true,
    popular: true,
  },
  {
    id: "generative-ai-developer",
    name: "Generative AI Developer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "GenAI",
      "Gen AI",
      "Generative AI",
      "GenAI Developer",
      "AI Developer",
      "AI",
    ],
    description:
      "Writes the day-to-day integration code for generative features: streaming, token budgets, structured output and graceful degradation.",
  },
  {
    id: "genai-engineer",
    name: "GenAI Engineer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "GenAI",
      "Gen AI",
      "Generative AI",
      "Generative AI Engineer",
      "LLM Engineer",
      "AI",
    ],
    description:
      "The abbreviated form of Generative AI Engineer, and the way the role is most often written on job boards and internal ladders.",
  },
  {
    id: "genai-developer",
    name: "GenAI Developer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "GenAI",
      "Gen AI",
      "Generative AI",
      "Generative AI Developer",
      "AI Developer",
      "AI",
    ],
    description:
      "The abbreviated form of Generative AI Developer, typically a build-and-ship role rather than a design-the-system one.",
  },
  {
    id: "llm-engineer",
    name: "LLM Engineer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "LLM",
      "Large Language Model",
      "GenAI",
      "Gen AI",
      "Generative AI",
      "Large Language Model Engineer",
      "AI",
    ],
    description:
      "Specialises in language models specifically: context construction, tool calling, latency and cost trade-offs, and evaluating outputs that have no single right answer.",
    suggested: true,
    popular: true,
  },
  {
    id: "large-language-model-engineer",
    name: "Large Language Model Engineer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "LLM",
      "Large Language Model",
      "GenAI",
      "Gen AI",
      "Generative AI",
      "LLM Engineer",
      "AI",
    ],
    description:
      "The spelled-out form of LLM Engineer, more common in enterprise and public-sector postings that avoid abbreviations.",
  },
  {
    id: "llm-developer",
    name: "LLM Developer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "LLM",
      "Large Language Model",
      "GenAI",
      "Gen AI",
      "Generative AI",
      "LLM Programmer",
      "AI",
    ],
    description:
      "Implements against language-model APIs and SDKs, focusing on getting reliable structured behaviour out of a probabilistic system.",
  },
  {
    id: "llm-application-engineer",
    name: "LLM Application Engineer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "LLM",
      "Large Language Model",
      "GenAI",
      "Gen AI",
      "Generative AI",
      "LLM App Engineer",
      "AI Application Engineer",
      "AI",
    ],
    description:
      "Builds complete applications around a language model, where the hard parts are session state, retrieval, guardrails and recovering from a bad generation.",
  },
  {
    id: "llm-application-developer",
    name: "LLM Application Developer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "LLM",
      "Large Language Model",
      "GenAI",
      "Gen AI",
      "Generative AI",
      "LLM App Developer",
      "AI",
    ],
    description:
      "The delivery-side variant of LLM Application Engineer, usually shipping against an architecture somebody else has already set.",
  },
  {
    id: "ai-copilot-engineer",
    name: "AI Copilot Engineer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "Copilot",
      "AI Copilot",
      "GenAI",
      "Gen AI",
      "Generative AI",
      "LLM",
      "Large Language Model",
      "AI Assistant Engineer",
      "AI",
    ],
    description:
      "Builds in-product assistants that work alongside the user -- suggesting, drafting and acting inside an existing interface rather than replacing it with a chat box.",
  },
  {
    id: "fine-tuning-engineer",
    name: "Fine-tuning Engineer",
    categoryId: "ai-ml",
    subcategory: "Generative AI",
    aliases: [
      "Fine Tuning",
      "Finetuning",
      "LLM",
      "Large Language Model",
      "GenAI",
      "Gen AI",
      "Generative AI",
      "LoRA",
      "Model Training Engineer",
      "AI",
    ],
    description:
      "Adapts existing foundation models to a domain through fine-tuning and preference training, and owns the dataset curation that decides whether it works.",
  },

  // ---------------------------------------------------------------------------
  // Agentic AI
  //
  // The newest block, and the one where titles are least settled -- which is
  // exactly why the aliases here are uniform. Every entry carries "Agentic",
  // "Agentic AI", "AI Agent" and "Agents", so any of the four phrasings finds
  // all eight roles.
  // ---------------------------------------------------------------------------
  {
    id: "ai-agent-engineer",
    name: "AI Agent Engineer",
    categoryId: "ai-ml",
    subcategory: "Agentic AI",
    aliases: [
      "Agentic",
      "Agentic AI",
      "AI Agent",
      "Agents",
      "Agent Engineer",
      "LLM Agent Engineer",
      "AI",
    ],
    description:
      "Builds systems that plan and act over multiple steps with tools, owning the loop control, retries and stopping conditions that keep them from running away.",
  },
  {
    id: "agentic-ai-engineer",
    name: "Agentic AI Engineer",
    categoryId: "ai-ml",
    subcategory: "Agentic AI",
    aliases: [
      "Agentic",
      "Agentic AI",
      "AI Agent",
      "Agents",
      "AI Agent Engineer",
      "Autonomous Agent Engineer",
      "AI",
    ],
    description:
      "Designs autonomous and semi-autonomous agent architectures, deciding where the model gets to choose and where the code must not let it.",
    popular: true,
  },
  {
    id: "ai-agent-developer",
    name: "AI Agent Developer",
    categoryId: "ai-ml",
    subcategory: "Agentic AI",
    aliases: [
      "Agentic",
      "Agentic AI",
      "AI Agent",
      "Agents",
      "Agent Developer",
      "AI",
    ],
    description:
      "Implements agents against a defined framework: writing the tools, the schemas they expose, and the tests that prove the agent uses them correctly.",
  },
  {
    id: "agent-engineer",
    name: "Agent Engineer",
    categoryId: "ai-ml",
    subcategory: "Agentic AI",
    aliases: [
      "Agentic",
      "Agentic AI",
      "AI Agent",
      "Agents",
      "AI Agent Engineer",
      "AI",
    ],
    description:
      "The short-form title, used where agents are the whole product rather than one feature of it.",
  },
  {
    id: "agentic-systems-engineer",
    name: "Agentic Systems Engineer",
    categoryId: "ai-ml",
    subcategory: "Agentic AI",
    aliases: [
      "Agentic",
      "Agentic AI",
      "AI Agent",
      "Agents",
      "Multi-Agent Systems Engineer",
      "AI Systems Engineer",
      "AI",
    ],
    description:
      "Works at the level of several agents co-operating, dealing with delegation, shared state, deadlock and the cost of a conversation that never converges.",
  },
  {
    id: "ai-workflow-engineer",
    name: "AI Workflow Engineer",
    categoryId: "ai-ml",
    subcategory: "Agentic AI",
    aliases: [
      "Agentic",
      "Agentic AI",
      "AI Agent",
      "Agents",
      "Workflow Automation Engineer",
      "AI Automation Engineer",
      "AI",
    ],
    description:
      "Composes model calls, tools and human approval steps into repeatable business workflows, favouring a predictable graph over open-ended autonomy.",
  },
  {
    id: "ai-orchestration-engineer",
    name: "AI Orchestration Engineer",
    categoryId: "ai-ml",
    subcategory: "Agentic AI",
    aliases: [
      "Agentic",
      "Agentic AI",
      "AI Agent",
      "Agents",
      "LLM Orchestration Engineer",
      "AI Pipeline Engineer",
      "AI",
    ],
    description:
      "Owns the layer that routes work between models, tools and services -- model selection, fallback chains, and keeping one slow dependency from stalling everything.",
  },
  {
    id: "ai-automation-developer",
    name: "AI Automation Developer",
    categoryId: "ai-ml",
    subcategory: "Agentic AI",
    aliases: [
      "Agentic",
      "Agentic AI",
      "AI Agent",
      "Agents",
      "Automation Developer",
      "Intelligent Automation Developer",
      "AI",
    ],
    description:
      "Delivers agent-based automations for specific teams, usually on low-code or workflow platforms, and measures success in hours of manual work removed.",
  },

  // ---------------------------------------------------------------------------
  // Prompt & RAG
  //
  // Two adjacent specialisms kept in one group because candidates think of them
  // together, but the descriptions deliberately pull them apart: prompt work is
  // about instructing the model, retrieval work is about what you put in front
  // of it. The interviews share very little.
  // ---------------------------------------------------------------------------
  {
    id: "prompt-engineer",
    name: "Prompt Engineer",
    categoryId: "ai-ml",
    subcategory: "Prompt & RAG",
    aliases: [
      "Prompt",
      "Prompting",
      "AI Prompt Engineer",
      "LLM",
      "Large Language Model",
      "GenAI",
      "Generative AI",
      "AI",
    ],
    description:
      "Gets reliable behaviour out of a model by shaping its instructions, examples and output format, and proves it with a test set rather than a hunch.",
    suggested: true,
    popular: true,
  },
  {
    id: "ai-prompt-engineer",
    name: "AI Prompt Engineer",
    categoryId: "ai-ml",
    subcategory: "Prompt & RAG",
    aliases: [
      "Prompt",
      "Prompting",
      "Prompt Engineer",
      "LLM",
      "Large Language Model",
      "GenAI",
      "Generative AI",
      "AI",
    ],
    description:
      "The same discipline written with the AI prefix, common where prompt work sits inside a broader AI team rather than standing alone.",
  },
  {
    id: "prompt-designer",
    name: "Prompt Designer",
    categoryId: "ai-ml",
    subcategory: "Prompt & RAG",
    aliases: [
      "Prompt",
      "Prompting",
      "Prompt Engineer",
      "Conversation Designer",
      "AI Content Designer",
      "AI",
    ],
    description:
      "Shapes the voice, framing and structure of model instructions from a content and user-experience angle rather than an engineering one.",
  },
  {
    id: "rag-engineer",
    name: "RAG Engineer",
    categoryId: "ai-ml",
    subcategory: "Prompt & RAG",
    aliases: [
      "RAG",
      "Retrieval Augmented Generation",
      "Retrieval-Augmented Generation",
      "LLM",
      "Large Language Model",
      "GenAI",
      "Generative AI",
      "AI",
    ],
    description:
      "Builds the retrieval pipeline that grounds a model in your own documents -- chunking, indexing, reranking, and measuring whether the citation is actually right.",
    popular: true,
  },
  {
    id: "retrieval-augmented-generation-engineer",
    name: "Retrieval-Augmented Generation Engineer",
    categoryId: "ai-ml",
    subcategory: "Prompt & RAG",
    aliases: [
      "RAG",
      "Retrieval Augmented Generation",
      "RAG Engineer",
      "LLM",
      "Large Language Model",
      "AI",
    ],
    description:
      "The spelled-out form of RAG Engineer, as the role appears in postings that expand every acronym.",
  },
  {
    id: "ai-search-engineer",
    name: "AI Search Engineer",
    categoryId: "ai-ml",
    subcategory: "Prompt & RAG",
    aliases: [
      "RAG",
      "Retrieval Augmented Generation",
      "Semantic Search Engineer",
      "Search Engineer",
      "Neural Search Engineer",
      "AI",
    ],
    description:
      "Works on relevance itself: hybrid keyword and semantic retrieval, ranking signals, and the evaluation sets that say whether a change helped.",
  },
  {
    id: "vector-database-engineer",
    name: "Vector Database Engineer",
    categoryId: "ai-ml",
    subcategory: "Prompt & RAG",
    aliases: [
      "Vector DB",
      "Vector Search",
      "RAG",
      "Retrieval Augmented Generation",
      "Embeddings",
      "Vector Store Engineer",
      "AI",
    ],
    description:
      "Runs the vector storage layer -- index choice, recall against latency, sharding, and reindexing without taking search down.",
  },
  {
    id: "embeddings-engineer",
    name: "Embeddings Engineer",
    categoryId: "ai-ml",
    subcategory: "Prompt & RAG",
    aliases: [
      "Embeddings",
      "Vector Search",
      "RAG",
      "Retrieval Augmented Generation",
      "Representation Learning Engineer",
      "AI",
    ],
    description:
      "Chooses, adapts and evaluates the embedding models a retrieval system depends on, including when a domain needs its own rather than an off-the-shelf one.",
  },

  // ---------------------------------------------------------------------------
  // Conversational AI
  //
  // Chat, voice and speech. The voice and speech roles carry audio-specific
  // aliases -- "ASR", "TTS", "Speech to Text" -- because somebody hiring for
  // speech work searches for the modality, not for "AI".
  // ---------------------------------------------------------------------------
  {
    id: "conversational-ai-engineer",
    name: "Conversational AI Engineer",
    categoryId: "ai-ml",
    subcategory: "Conversational AI",
    aliases: [
      "Conversational AI",
      "Chatbot",
      "Dialogue Systems Engineer",
      "Virtual Assistant Engineer",
      "NLP",
      "Natural Language Processing",
      "AI",
    ],
    description:
      "Builds multi-turn conversational systems, owning dialogue state, intent handling and what happens when the user goes off-script.",
    popular: true,
  },
  {
    id: "conversational-ai-developer",
    name: "Conversational AI Developer",
    categoryId: "ai-ml",
    subcategory: "Conversational AI",
    aliases: [
      "Conversational AI",
      "Chatbot",
      "Chatbot Developer",
      "Virtual Assistant Developer",
      "AI",
    ],
    description:
      "Implements conversational flows and integrations on an existing platform, connecting the bot to the systems it needs to actually resolve a request.",
  },
  {
    id: "chatbot-developer",
    name: "Chatbot Developer",
    categoryId: "ai-ml",
    subcategory: "Conversational AI",
    aliases: ["Chatbot", "Chat Bot", "Conversational AI", "Bot Developer", "AI"],
    description:
      "Builds customer-facing chat assistants, and is measured on containment and resolution rate rather than on model sophistication.",
  },
  {
    id: "ai-assistant-developer",
    name: "AI Assistant Developer",
    categoryId: "ai-ml",
    subcategory: "Conversational AI",
    aliases: [
      "AI Assistant",
      "Virtual Assistant",
      "Conversational AI",
      "Copilot",
      "LLM",
      "AI",
    ],
    description:
      "Builds general-purpose assistants that answer questions and take actions across several connected systems on the user's behalf.",
  },
  {
    id: "voice-ai-engineer",
    name: "Voice AI Engineer",
    categoryId: "ai-ml",
    subcategory: "Conversational AI",
    aliases: [
      "Voice AI",
      "Voice",
      "Speech",
      "Conversational AI",
      "Voice Assistant Engineer",
      "TTS",
      "AI",
    ],
    description:
      "Builds real-time spoken interfaces, where latency, barge-in and turn-taking matter as much as what the model actually says.",
  },
  {
    id: "speech-ai-engineer",
    name: "Speech AI Engineer",
    categoryId: "ai-ml",
    subcategory: "Conversational AI",
    aliases: [
      "Speech",
      "Speech AI",
      "Voice AI",
      "ASR",
      "TTS",
      "Text to Speech",
      "AI",
    ],
    description:
      "Works on the speech stack itself -- recognition, synthesis, diarisation -- and on how each degrades with accent, noise and bad microphones.",
  },
  {
    id: "speech-recognition-engineer",
    name: "Speech Recognition Engineer",
    categoryId: "ai-ml",
    subcategory: "Conversational AI",
    aliases: [
      "ASR",
      "Speech Recognition",
      "Speech to Text",
      "STT",
      "Speech",
      "Voice AI",
      "AI",
    ],
    description:
      "Specialises in turning audio into accurate text, tuning acoustic and language models against word error rate on real recordings.",
  },

  // ---------------------------------------------------------------------------
  // Computer Vision & NLP
  //
  // The two long-standing modality specialisms, plus multimodal, which is
  // increasingly where both are heading. "CV" and "NLP" are near-universal in
  // queries and appear in only one name each, so both blocks carry the
  // abbreviation and the spelled-out form.
  // ---------------------------------------------------------------------------
  {
    id: "computer-vision-engineer",
    name: "Computer Vision Engineer",
    categoryId: "ai-ml",
    subcategory: "Computer Vision & NLP",
    aliases: [
      "CV",
      "Computer Vision",
      "Vision Engineer",
      "Image Processing Engineer",
      "ML",
      "Machine Learning",
      "AI",
    ],
    description:
      "Builds systems that interpret images and video -- detection, segmentation, tracking -- and gets them fast enough for the device they ship on.",
    suggested: true,
    popular: true,
  },
  {
    id: "computer-vision-scientist",
    name: "Computer Vision Scientist",
    categoryId: "ai-ml",
    subcategory: "Computer Vision & NLP",
    aliases: [
      "CV",
      "Computer Vision",
      "Computer Vision Researcher",
      "Vision Researcher",
      "ML",
      "Machine Learning",
      "AI",
    ],
    description:
      "Researches vision methods and datasets, working closer to the literature than to the deployment target.",
  },
  {
    id: "nlp-engineer",
    name: "NLP Engineer",
    categoryId: "ai-ml",
    subcategory: "Computer Vision & NLP",
    aliases: [
      "NLP",
      "Natural Language Processing",
      "Text Mining Engineer",
      "Computational Linguist",
      "ML",
      "Machine Learning",
      "AI",
    ],
    description:
      "Builds systems that extract structure and meaning from text -- classification, entity extraction, summarisation -- with or without a large model behind them.",
    popular: true,
  },
  {
    id: "natural-language-processing-engineer",
    name: "Natural Language Processing Engineer",
    categoryId: "ai-ml",
    subcategory: "Computer Vision & NLP",
    aliases: [
      "NLP",
      "Natural Language Processing",
      "NLP Engineer",
      "ML",
      "Machine Learning",
      "AI",
    ],
    description:
      "The spelled-out form of NLP Engineer, still the standard phrasing in academic and enterprise postings.",
  },
  {
    id: "multimodal-ai-engineer",
    name: "Multimodal AI Engineer",
    categoryId: "ai-ml",
    subcategory: "Computer Vision & NLP",
    aliases: [
      "Multimodal",
      "Vision Language Model",
      "VLM",
      "CV",
      "Computer Vision",
      "NLP",
      "Natural Language Processing",
      "GenAI",
      "Generative AI",
      "AI",
    ],
    description:
      "Builds systems that reason across text, image and audio together, dealing with alignment between modalities and the failure cases unique to each.",
  },

  // ---------------------------------------------------------------------------
  // AI Research
  //
  // "Research Scientist" and "Research Engineer" are listed unqualified because
  // that is genuinely how the roles are advertised at AI labs, even though the
  // bare titles exist in other fields too. Their aliases pin them to AI so they
  // rank sensibly here rather than looking like a mis-file.
  // ---------------------------------------------------------------------------
  {
    id: "ai-research-engineer",
    name: "AI Research Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Research",
    aliases: [
      "Research Engineer",
      "ML Research Engineer",
      "ML",
      "Machine Learning",
      "AI Research",
      "AI",
    ],
    description:
      "Builds the infrastructure and experiments research depends on -- training runs, ablations, tooling -- rather than setting the research direction.",
  },
  {
    id: "ai-research-scientist",
    name: "AI Research Scientist",
    categoryId: "ai-ml",
    subcategory: "AI Research",
    aliases: [
      "Research Scientist",
      "AI Researcher",
      "ML",
      "Machine Learning",
      "AI Research",
      "AI",
    ],
    description:
      "Sets and pursues a research agenda, expected to publish and to defend method choices against the alternatives at interview.",
  },
  {
    id: "research-scientist",
    name: "Research Scientist",
    categoryId: "ai-ml",
    subcategory: "AI Research",
    aliases: [
      "AI Research Scientist",
      "ML",
      "Machine Learning",
      "Applied Scientist",
      "AI",
    ],
    description:
      "The unqualified title most AI labs use for the same work as AI Research Scientist.",
  },
  {
    id: "research-engineer",
    name: "Research Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Research",
    aliases: [
      "AI Research Engineer",
      "ML",
      "Machine Learning",
      "ML Engineer",
      "AI",
    ],
    description:
      "The unqualified lab title: strong engineering applied to research problems, judged on how quickly a good idea can be tested properly.",
  },

  // ---------------------------------------------------------------------------
  // AI Infrastructure
  //
  // Where AI work meets platform and hardware. Deliberately separate from MLOps
  // above, which sits with Machine Learning because its interview surface is the
  // model lifecycle; these roles get asked about GPUs, clusters and serving.
  // ---------------------------------------------------------------------------
  {
    id: "ai-platform-engineer",
    name: "AI Platform Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Infrastructure",
    aliases: [
      "ML Platform Engineer",
      "MLOps",
      "ML",
      "Machine Learning",
      "AI Infrastructure Engineer",
      "AI",
    ],
    description:
      "Builds the internal platform other AI teams build on: shared serving, gateways, quotas and the paved road that stops every team rolling their own.",
  },
  {
    id: "ai-infrastructure-engineer",
    name: "AI Infrastructure Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Infrastructure",
    aliases: [
      "ML Infrastructure Engineer",
      "MLOps",
      "ML",
      "Machine Learning",
      "AI Platform Engineer",
      "AI",
    ],
    description:
      "Runs the compute and storage AI workloads sit on -- clusters, schedulers, networking, and keeping expensive hardware busy.",
  },
  {
    id: "ml-platform-engineer",
    name: "ML Platform Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Infrastructure",
    aliases: ["Machine Learning Platform Engineer", "ML Infrastructure", "MLOps", "AI Platform"],
    description:
      "Builds the shared training, registry, deployment and observability platform that lets machine-learning teams ship models reliably.",
  },
  {
    id: "gpu-infrastructure-engineer",
    name: "GPU Infrastructure Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Infrastructure",
    aliases: [
      "GPU",
      "CUDA",
      "AI Infrastructure Engineer",
      "HPC Engineer",
      "Accelerator Engineer",
      "ML",
      "AI",
    ],
    description:
      "Specialises in accelerator hardware: scheduling, memory, interconnect, and squeezing utilisation out of a cluster that costs more per hour than the team does.",
  },
  {
    id: "model-deployment-engineer",
    name: "Model Deployment Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Infrastructure",
    aliases: [
      "Model Serving Engineer",
      "Inference Engineer",
      "MLOps",
      "ML",
      "Machine Learning",
      "AI",
    ],
    description:
      "Gets trained models serving in production -- packaging, quantisation, batching and autoscaling against a latency budget.",
  },

  // ---------------------------------------------------------------------------
  // AI Evaluation & Safety
  //
  // A block that barely existed as a hiring category two years ago and now has
  // its own ladder at most serious AI employers. Kept together because the
  // interviews rhyme: everyone here is asked, in some form, how they would know
  // if the system were behaving badly.
  // ---------------------------------------------------------------------------
  {
    id: "ai-evaluation-engineer",
    name: "AI Evaluation Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Evaluation & Safety",
    aliases: [
      "AI Evals",
      "Evals",
      "Evaluation Engineer",
      "ML",
      "Machine Learning",
      "AI",
    ],
    description:
      "Builds the measurement layer for AI systems: datasets, graders and regression suites that catch a quality drop before users do.",
  },
  {
    id: "llm-evaluation-engineer",
    name: "LLM Evaluation Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Evaluation & Safety",
    aliases: [
      "LLM",
      "Large Language Model",
      "LLM Evals",
      "AI Evals",
      "Evals",
      "GenAI",
      "Generative AI",
      "AI",
    ],
    description:
      "Focuses on evaluating language-model output specifically, including model-as-judge pipelines and knowing when a human rater is the only honest option.",
  },
  {
    id: "ai-safety-engineer",
    name: "AI Safety Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Evaluation & Safety",
    aliases: [
      "AI Safety",
      "Trust and Safety",
      "Model Safety Engineer",
      "Responsible AI",
      "AI",
    ],
    description:
      "Builds the guardrails, refusal behaviour and monitoring that keep a deployed model from producing harmful output at scale.",
  },
  {
    id: "ai-alignment-researcher",
    name: "AI Alignment Researcher",
    categoryId: "ai-ml",
    subcategory: "AI Evaluation & Safety",
    aliases: [
      "Alignment",
      "AI Alignment",
      "AI Safety",
      "Safety Researcher",
      "RLHF",
      "AI",
    ],
    description:
      "Researches how to make model behaviour match human intent, working on training signals and interpretability rather than on product guardrails.",
  },
  {
    id: "ai-red-team-engineer",
    name: "AI Red Team Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Evaluation & Safety",
    aliases: [
      "Red Team",
      "AI Red Teaming",
      "Adversarial ML",
      "Prompt Injection",
      "AI Security Engineer",
      "AI Safety",
      "AI",
    ],
    description:
      "Attacks the organisation's own AI systems -- jailbreaks, prompt injection, data exfiltration -- and writes the findings up as fixable defects.",
  },
  {
    id: "ai-governance-specialist",
    name: "AI Governance Specialist",
    categoryId: "ai-ml",
    subcategory: "AI Evaluation & Safety",
    aliases: [
      "AI Governance",
      "AI Compliance",
      "AI Risk",
      "EU AI Act",
      "Responsible AI",
      "AI",
    ],
    description:
      "Sets the policies, model inventories and approval gates that let an organisation deploy AI and evidence that it did so lawfully.",
  },
  {
    id: "responsible-ai-specialist",
    name: "Responsible AI Specialist",
    categoryId: "ai-ml",
    subcategory: "AI Evaluation & Safety",
    aliases: [
      "Responsible AI",
      "AI Ethics",
      "Fairness",
      "Bias",
      "AI Governance",
      "AI",
    ],
    description:
      "Works with product teams on fairness, transparency and bias testing, translating principles into checks a team can actually run.",
  },
  {
    id: "responsible-ai-engineer",
    name: "Responsible AI Engineer",
    categoryId: "ai-ml",
    subcategory: "AI Evaluation & Safety",
    aliases: ["Responsible AI", "AI Ethics Engineer", "AI Fairness Engineer", "AI Governance"],
    description:
      "Implements practical fairness, transparency, privacy and safety controls in the systems that train, evaluate and serve AI models.",
  },
  {
    id: "ai-ethics-specialist",
    name: "AI Ethics Specialist",
    categoryId: "ai-ml",
    subcategory: "AI Evaluation & Safety",
    aliases: [
      "AI Ethics",
      "Responsible AI",
      "Ethics",
      "AI Policy",
      "AI Governance",
      "AI",
    ],
    description:
      "Assesses the human impact of AI systems and advises on where a technically feasible use case should nonetheless not be built.",
  },

  // ---------------------------------------------------------------------------
  // AI Leadership & Consulting
  //
  // Architecture, product and advisory. These interviews go wide rather than
  // deep -- build versus buy, cost, sequencing, and explaining a probabilistic
  // system to people who expect deterministic software -- which is why they are
  // grouped away from the hands-on engineering blocks.
  // ---------------------------------------------------------------------------
  {
    id: "ai-solutions-architect",
    name: "AI Solutions Architect",
    categoryId: "ai-ml",
    subcategory: "AI Leadership & Consulting",
    aliases: [
      "AI Architect",
      "Solutions Architect",
      "ML",
      "Machine Learning",
      "GenAI",
      "Generative AI",
      "AI",
    ],
    description:
      "Designs end-to-end AI solutions for a customer or business unit, owning the build-versus-buy call and the integration plan that follows from it.",
    popular: true,
  },
  {
    id: "ai-architect",
    name: "AI Architect",
    categoryId: "ai-ml",
    subcategory: "AI Leadership & Consulting",
    aliases: [
      "AI Solutions Architect",
      "ML Architect",
      "Machine Learning",
      "Enterprise AI Architect",
      "AI",
    ],
    description:
      "Sets the AI architecture standards an organisation builds to -- model choice, data boundaries, and what gets reused across teams.",
  },
  {
    id: "ai-technical-architect",
    name: "AI Technical Architect",
    categoryId: "ai-ml",
    subcategory: "AI Leadership & Consulting",
    aliases: [
      "AI Architect",
      "Technical Architect",
      "AI Solutions Architect",
      "ML",
      "Machine Learning",
      "AI",
    ],
    description:
      "The hands-on architect variant, still writing reference implementations and reviewing designs rather than working purely at the diagram level.",
  },
  {
    id: "ai-product-manager",
    name: "AI Product Manager",
    categoryId: "ai-ml",
    subcategory: "AI Leadership & Consulting",
    aliases: [
      "AI PM",
      "GenAI Product Manager",
      "ML Product Manager",
      "Machine Learning",
      "GenAI",
      "Generative AI",
      "AI",
    ],
    description:
      "Owns an AI product's direction, and has to make scoping and pricing decisions about a system whose output quality cannot be promised in advance.",
    popular: true,
  },
  {
    id: "ai-consultant",
    name: "AI Consultant",
    categoryId: "ai-ml",
    subcategory: "AI Leadership & Consulting",
    aliases: [
      "AI Advisor",
      "GenAI Consultant",
      "Generative AI",
      "ML Consultant",
      "Machine Learning",
      "AI",
    ],
    description:
      "Advises client organisations on where AI is worth applying, and is judged on the cases they talk clients out of as much as the ones they take on.",
  },
  {
    id: "ai-technical-consultant",
    name: "AI Technical Consultant",
    categoryId: "ai-ml",
    subcategory: "AI Leadership & Consulting",
    aliases: [
      "AI Consultant",
      "Technical Consultant",
      "ML",
      "Machine Learning",
      "GenAI",
      "Generative AI",
      "AI",
    ],
    description:
      "The delivery-facing consultant who implements alongside the client's team rather than stopping at the recommendation.",
  },
  {
    id: "ai-program-manager",
    name: "AI Program Manager",
    categoryId: "ai-ml",
    subcategory: "AI Leadership & Consulting",
    aliases: [
      "AI Programme Manager",
      "AI Project Manager",
      "ML Program Manager",
      "AI TPM",
      "Technical Program Manager AI",
      "AI",
    ],
    description:
      "Runs AI initiatives across several teams, sequencing data readiness, model work and rollout so the dependencies do not deadlock.",
  },
];
