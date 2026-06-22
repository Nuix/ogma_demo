import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import { ClaudeEntityResponse } from '../types';
import https from 'https';
import { NodeHttpHandler } from '@smithy/node-http-handler';

// Configure AWS Bedrock client with custom HTTPS agent to handle corporate proxies
const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'us-east-1',
  requestHandler: new NodeHttpHandler({
    httpsAgent: new https.Agent({
      rejectUnauthorized: false, // Disable SSL verification for corporate proxy
    }),
  }),
});

const SYSTEM_PROMPT = `You are an AI assistant helping to analyze witness statements for an investigation board. Your task is to:

1. Extract relevant entities from the witness statement
2. Identify relationships between entities
3. Ensure content is appropriate for a workplace environment
4. Generate a brief case report

Entity types to extract:
- WITNESS: The person submitting the statement (if mentioned or provided)
- LOCATION: Places mentioned
- ACTIVITY: Actions or activities described
- TIME: Temporal references - IMPORTANT: Convert relative time references to actual dates:
  * "yesterday" → actual date (e.g., "2026-06-13")
  * "today" → actual date (e.g., "2026-06-14")
  * "last week" → date range or specific date
  * "Monday" → actual date of that Monday
  * Keep specific dates and times as-is (e.g., "June 10", "2026-06-10", "3pm")

Relationship types:
- REPORTED_SIGHTING_AT: Witness reports seeing subject at location
- SEEN_AT: Subject seen at location
- DOING: Subject performing activity
- WITH: Subject seen with person/object
- DURING: Activity during time period
- LOCATED_IN: Location within another location

Content moderation:
- Reject statements with profanity, harassment, or inappropriate content
- Reject statements that are completely unrelated or spam
- Accept creative, humorous, or absurd statements as long as they're work-appropriate

Respond ONLY with valid JSON matching this structure:
{
  "approved": boolean,
  "reason": "string (only if rejected)",
  "entities": [{"type": "entity_type", "label": "entity_name"}],
  "relationships": [{"from": "entity_label", "to": "entity_label", "type": "relationship_type"}],
  "caseReport": "Brief investigative summary in detective style"
}`;

export async function analyzeWitnessStatement(
  statement: string,
  witnessName?: string,
  targetName?: string
): Promise<ClaudeEntityResponse> {
  const currentDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

  const userPrompt = `Current Date: ${currentDate}
Witness Name: ${witnessName || 'Anonymous'}
Target Person: ${targetName || process.env.TARGET_NAME || '[TARGET]'}
Statement: ${statement}

Please analyze this witness statement and respond in the JSON format specified. Remember to convert relative time references (yesterday, today, etc.) to actual dates based on the current date provided above.`;

  try {
    const payload = {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    };

    const command = new InvokeModelCommand({
      modelId: process.env.ANTHROPIC_MODEL || 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
      contentType: 'application/json',
      accept: 'application/json',
      body: JSON.stringify(payload),
    });

    const result = await client.send(command);

    // Decode the response body
    const bodyText = new TextDecoder().decode(result.body);
    console.log('Bedrock raw response:', bodyText);

    const responseBody = JSON.parse(bodyText);

    const content = responseBody.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type from Claude API');
    }

    console.log('Claude content text:', content.text);

    // Strip markdown code fences if present
    let textToParse = content.text.trim();
    if (textToParse.startsWith('```')) {
      textToParse = textToParse
        .replace(/^```json?\n?/i, '')
        .replace(/\n?```$/, '');
    }

    const response = JSON.parse(textToParse) as ClaudeEntityResponse;

    // Validate response structure
    if (
      typeof response.approved !== 'boolean' ||
      !Array.isArray(response.entities) ||
      !Array.isArray(response.relationships) ||
      typeof response.caseReport !== 'string'
    ) {
      throw new Error('Invalid response structure from Claude API');
    }

    return response;
  } catch (error) {
    console.error('Error analyzing witness statement:', error);

    // Fallback rejection if Claude API fails
    return {
      approved: false,
      reason: 'Unable to process statement at this time',
      entities: [],
      relationships: [],
      caseReport: 'ERROR: Statement could not be analyzed',
    };
  }
}
