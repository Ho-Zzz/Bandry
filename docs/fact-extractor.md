# Fact Extractor - Documentation

## Overview

The Fact Extractor is a component of the memory system that uses LLM to extract structured facts from conversations and text. It provides intelligent fact extraction with confidence scoring, tag assignment, and various utility methods for fact management.

## Location

`src/main/memory/extraction/fact-extractor.ts`

## Features

✅ **LLM-based fact extraction** - Uses configured LLM to extract facts
✅ **Confidence scoring** - Each fact has a confidence score (0.0-1.0)
✅ **Tag assignment** - Automatic categorization with tags
✅ **Filtering** - Filter by confidence, tags, or custom criteria
✅ **Deduplication** - Merge duplicate facts
✅ **Sorting** - Sort by confidence or other criteria
✅ **Text extraction** - Extract from plain text or conversations

## Usage

### Basic Fact Extraction

```typescript
import { FactExtractor } from "./memory/extraction/fact-extractor";
import type { Conversation } from "./memory/contracts";

const extractor = new FactExtractor(modelsFactory, config);

const conversation: Conversation = {
  sessionId: "session_123",
  messages: [
    {
      role: "user",
      content: "I prefer TypeScript over JavaScript",
      timestamp: Date.now()
    },
    {
      role: "assistant",
      content: "Great choice! TypeScript provides type safety.",
      timestamp: Date.now()
    }
  ]
};

const facts = await extractor.extractFacts(conversation);
// Returns: [
//   {
//     id: "session_123_fact_0",
//     content: "User prefers TypeScript over JavaScript",
//     source: "session_123",
//     timestamp: 1234567890,
//     tags: ["preference", "language"],
//     confidence: 0.9
//   }
// ]
```

### Extract from Plain Text

```typescript
const facts = await extractor.extractFromText(
  "The project uses Vite for bundling and Vitest for testing",
  "documentation"
);
```

### Filter by Confidence

```typescript
const facts = await extractor.extractFacts(conversation, {
  minConfidence: 0.7  // Only facts with confidence >= 0.7
});
```

### Limit Number of Facts

```typescript
const facts = await extractor.extractFacts(conversation, {
  maxFacts: 10  // Extract up to 10 facts
});
```

### Custom Temperature

```typescript
const facts = await extractor.extractFacts(conversation, {
  temperature: 0.1  // Lower temperature for more deterministic extraction
});
```

## Fact Structure

```typescript
type Fact = {
  id: string;              // Unique identifier (e.g., "session_123_fact_0")
  content: string;         // The fact content
  source: string;          // Source identifier (session ID or text source)
  timestamp: number;       // Unix timestamp when fact was extracted
  tags?: string[];         // Categorization tags
  confidence?: number;     // Confidence score (0.0-1.0)
};
```

## Utility Methods

### Merge Duplicate Facts

```typescript
const facts = [
  { id: "1", content: "User prefers TypeScript", ... },
  { id: "2", content: "User prefers TypeScript", ... },  // Duplicate
  { id: "3", content: "Project uses Vite", ... }
];

const merged = extractor.mergeFacts(facts);
// Returns: 2 facts (duplicate removed)
```

### Filter by Tags

```typescript
const facts = [
  { id: "1", content: "...", tags: ["preference", "language"], ... },
  { id: "2", content: "...", tags: ["tooling", "build"], ... },
  { id: "3", content: "...", tags: ["preference"], ... }
];

const filtered = extractor.filterByTags(facts, ["preference"]);
// Returns: Facts with "preference" tag
```

### Sort by Confidence

```typescript
const sorted = extractor.sortByConfidence(facts);
// Returns: Facts sorted by confidence (highest first)
```

### Get Top N Facts

```typescript
const top5 = extractor.getTopFacts(facts, 5);
// Returns: Top 5 facts by confidence
```

## Extraction Options

```typescript
type FactExtractionOptions = {
  temperature?: number;      // LLM temperature (default: 0.2)
  maxFacts?: number;         // Maximum facts to extract (default: 20)
  minConfidence?: number;    // Minimum confidence threshold (default: 0.5)
};
```

## Tag Categories

Common tags assigned by the extractor:

- **preference** - User preferences and choices
- **language** - Programming language related
- **tooling** - Tools and frameworks
- **build** - Build system related
- **testing** - Testing related
- **requirement** - Project requirements
- **constraint** - Technical constraints
- **decision** - Technical decisions
- **configuration** - Configuration settings

## Integration with OpenViking Memory

The fact extractor is integrated into the OpenViking memory adapter:

```typescript
const memory = new OpenVikingMemory(
  resourcesPath,
  modelsFactory,
  config
);

// Fact extraction happens automatically during conversation storage
await memory.storeConversation(conversation);
// → Extracts facts
// → Generates L2 (full content)
// → Summarizes to L1 (outline)
// → Summarizes to L0 (summary)
```

## System Prompt

The fact extractor uses a carefully crafted system prompt:

```
You are a fact extraction system. Extract key facts from the conversation.

Rules:
1. Extract only important, actionable facts
2. Ignore pleasantries, greetings, and meta-discussion
3. Focus on: preferences, decisions, technical details, requirements, constraints
4. Each fact should be self-contained and clear
5. Assign relevant tags to each fact
6. Assign confidence score (0.0-1.0) based on clarity and importance
7. Extract up to N facts

Return a JSON array of facts in this format:
[
  {
    "content": "User prefers TypeScript over JavaScript",
    "tags": ["preference", "language"],
    "confidence": 0.9
  }
]
```

## Error Handling

The fact extractor handles errors gracefully:

- **Empty conversation** - Returns empty array
- **Invalid JSON** - Returns empty array, logs warning
- **LLM failure** - Returns empty array, logs error
- **Invalid fact structure** - Skips invalid facts, logs warning

## Performance

- **Extraction time**: ~1-3 seconds (depends on LLM)
- **Memory usage**: Minimal (facts are small objects)
- **Caching**: No caching (each extraction is fresh)

## Testing

The fact extractor has comprehensive test coverage:

```bash
# Run fact extractor tests
pnpm test src/main/memory/extraction/tests/fact-extractor.test.ts
```

**Test Coverage**:
- ✅ Extract facts from conversation
- ✅ Filter by minimum confidence
- ✅ Handle empty conversation
- ✅ Handle invalid JSON response
- ✅ Extract from plain text
- ✅ Merge duplicate facts
- ✅ Filter by tags
- ✅ Sort by confidence
- ✅ Get top N facts

## Example Workflow

```typescript
// 1. Create extractor
const extractor = new FactExtractor(modelsFactory, config);

// 2. Extract facts from conversation
const facts = await extractor.extractFacts(conversation, {
  temperature: 0.2,
  maxFacts: 20,
  minConfidence: 0.7
});

// 3. Filter by tags
const preferences = extractor.filterByTags(facts, ["preference"]);

// 4. Get top facts
const topFacts = extractor.getTopFacts(preferences, 5);

// 5. Merge duplicates
const merged = extractor.mergeFacts(topFacts);

// 6. Use facts for memory storage or other purposes
console.log(merged);
```

## Best Practices

1. **Set appropriate confidence threshold** - Use 0.5-0.7 for general use
2. **Limit max facts** - Don't extract too many facts (10-20 is good)
3. **Use lower temperature** - 0.1-0.3 for more consistent extraction
4. **Merge duplicates** - Always merge after extracting from multiple sources
5. **Filter by tags** - Use tags to organize and retrieve facts
6. **Sort by confidence** - Prioritize high-confidence facts

## Known Limitations

- Extraction quality depends on LLM quality
- No semantic similarity detection (only exact duplicates)
- Tags are LLM-generated (may vary)
- No fact validation or verification
- No incremental extraction (always full extraction)

## Future Enhancements

- Semantic similarity detection for better deduplication
- Fact validation and verification
- Incremental extraction (only new facts)
- Custom tag taxonomies
- Fact relationships and dependencies
- Multi-language support

---

The fact extractor is production-ready and fully integrated with the memory system!
