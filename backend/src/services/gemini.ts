import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Locale-aware AI output language helper
const LOCALE_MAP: Record<string, string> = {
  'en': 'Respond in English.',
  'zh-TW': 'Respond in Traditional Chinese (繁體中文).',
  'zh-CN': 'Respond in Simplified Chinese (简体中文).',
  'ja': 'Respond in Japanese (日本語).',
  'ko': 'Respond in Korean (한국어).',
  'vi': 'Respond in Vietnamese (Tiếng Việt).',
  'th': 'Respond in Thai (ไทย).',
  'es': 'Respond in Spanish (Español).',
  'fr': 'Respond in French (Français).',
}

export function getLocaleInstruction(locale?: string): string {
  return LOCALE_MAP[locale || 'zh-TW'] || LOCALE_MAP['zh-TW']
}

let genAI: GoogleGenerativeAI | null = null
let model: any = null
let visionModel: any = null

export function initGemini(): boolean {
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY not set - AI features disabled')
    return false
  }

  genAI = new GoogleGenerativeAI(GEMINI_API_KEY)
  model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })
  console.log('Gemini AI initialized')
  return true
}

export function isGeminiAvailable(): boolean {
  return model !== null
}

export interface ScannedContactData {
  name: string
  nameRomanized?: string
  company?: string
  title?: string
  email?: string
  phone?: string[]
  address?: string
  website?: string
  social?: {
    linkedin?: string
    twitter?: string
    other?: string
  }
}

export interface ParsedContactData {
  name?: string
  company?: string
  title?: string
  industry?: string
  howMet?: {
    event?: string
    date?: string
    introducer?: string
    location?: string
  }
  notes?: string
  skills?: string[]
}

/**
 * OCR scan a business card image and extract contact information
 */
export async function scanBusinessCard(imageBase64: string, mimeType: string = 'image/jpeg'): Promise<ScannedContactData> {
  if (!model) {
    throw new Error('Gemini AI not initialized')
  }

  const prompt = `Analyze this business card image and extract all contact information.
Return the data as valid JSON with this exact structure:
{
  "name": "Full name as shown",
  "nameRomanized": "Romanized name if the original is in CJK characters, otherwise omit",
  "company": "Company or organization name",
  "title": "Job title or position",
  "email": "Email address",
  "phone": ["Array of phone numbers"],
  "address": "Full address if present",
  "website": "Website URL if present",
  "social": {
    "linkedin": "LinkedIn URL if present",
    "twitter": "Twitter handle if present",
    "other": "Other social media"
  }
}

Rules:
- Return ONLY valid JSON, no markdown formatting, no code blocks
- Omit any fields that are not present on the card
- For phone numbers, include country code if visible
- Clean up formatting (remove extra spaces, standardize phone formats)
- If name is in Chinese/Japanese/Korean, also provide romanized version`

  const result = await model.generateContent([
    prompt,
    {
      inlineData: {
        mimeType,
        data: imageBase64
      }
    }
  ])

  const responseText = result.response.text().trim()

  // Clean up response (remove markdown code blocks if present)
  let jsonText = responseText
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
  }

  try {
    return JSON.parse(jsonText) as ScannedContactData
  } catch (e) {
    console.error('Failed to parse Gemini response:', responseText)
    throw new Error('Failed to parse business card data')
  }
}

/**
 * Parse natural language description into structured contact data
 */
export async function parseNaturalLanguage(input: string): Promise<ParsedContactData> {
  if (!model) {
    throw new Error('Gemini AI not initialized')
  }

  const prompt = `Parse this description of a person/contact into structured data:

"${input}"

Return the data as valid JSON with this structure:
{
  "name": "Person's name",
  "company": "Company or organization",
  "title": "Job title or role",
  "industry": "Industry or field",
  "howMet": {
    "event": "Event or occasion where you met",
    "date": "When you met (if mentioned)",
    "introducer": "Who introduced you (if mentioned)",
    "location": "Where you met (if mentioned)"
  },
  "notes": "Any other relevant information",
  "skills": ["Array of skills or expertise mentioned"]
}

Rules:
- Return ONLY valid JSON, no markdown formatting, no code blocks
- Omit any fields that cannot be inferred from the input
- Extract as much information as possible
- Be smart about inferring context (e.g., "met at Google" implies company is Google)
- Keep notes concise and relevant`

  const result = await model.generateContent(prompt)
  const responseText = result.response.text().trim()

  // Clean up response
  let jsonText = responseText
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
  }

  try {
    return JSON.parse(jsonText) as ParsedContactData
  } catch (e) {
    console.error('Failed to parse Gemini response:', responseText)
    throw new Error('Failed to parse natural language input')
  }
}

/**
 * Generate an introduction request message
 */
export async function generateIntroMessage(
  path: { name: string; company?: string; relationship?: string }[],
  goal: string,
  tone: 'formal' | 'casual' | 'brief' = 'formal',
  senderName?: string,
  senderBio?: string
): Promise<string> {
  if (!model) {
    throw new Error('Gemini AI not initialized')
  }

  const requesterName = senderName || path[0]?.name || '我'

  const pathDescription = path.map((p, i) => {
    if (i === 0) return `${requesterName} (the person writing this message)`
    if (i === path.length - 1) return `${p.name} (target: ${p.company || 'unknown company'})`
    return `${p.name} (${p.company || ''}, ${p.relationship || 'connection'})`
  }).join(' → ')

  const toneGuidelines = {
    formal: 'Professional and polite, suitable for business communication',
    casual: 'Friendly and conversational, but still respectful',
    brief: 'Short and direct, getting straight to the point'
  }

  // Build sender context with bio if available
  const senderContext = senderBio
    ? `Sender's background/goal: ${senderBio}`
    : ''

  const prompt = `Generate an introduction request message in Traditional Chinese (繁體中文).

Introduction path: ${pathDescription}
Sender's name: ${requesterName}
${senderContext}
Goal: ${goal}
Tone: ${toneGuidelines[tone]}

The message should:
1. Address the first intermediary (${path[1]?.name || 'intermediary'}) respectfully
2. Reference the relationship between ${requesterName} and them
3. Clearly explain why ${requesterName} wants an introduction to ${path[path.length - 1]?.name || 'the target'}
4. State the goal: ${goal}${senderBio ? `\n5. Naturally incorporate the sender's background/purpose: ${senderBio}` : ''}
5. Be ${tone} in tone
6. Sign off with the sender's actual name: ${requesterName}

IMPORTANT: DO NOT use placeholders like [你的名字], [Your Name], or similar. Always use the actual sender's name "${requesterName}" in the signature.

Return ONLY the message text, no additional formatting or explanation.`

  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}

/**
 * Generate AI summary for a contact
 */
export async function generateContactSummary(
  contact: any,
  careerHistory: any[],
  educationHistory: any[],
  interactions: any[],
  relationship: any
): Promise<string> {
  if (!model) {
    throw new Error('Gemini AI not initialized')
  }

  const careerStr = careerHistory.length > 0
    ? careerHistory.map(c => `${c.title || 'Role'} at ${c.company} (${c.start_date || '?'} - ${c.end_date || 'present'})`).join('; ')
    : 'Unknown career history'

  const eduStr = educationHistory.length > 0
    ? educationHistory.map(e => `${e.degree || ''} ${e.field || ''} from ${e.school} (${e.end_year || '?'})`).join('; ')
    : 'Unknown education'

  const interactionStr = interactions.length > 0
    ? interactions.slice(0, 5).map(i => `${i.type} on ${i.occurred_at}: ${i.notes || 'No notes'}`).join('; ')
    : 'No recorded interactions'

  const prompt = `Generate a brief, helpful summary about this contact for a CRM system.

Contact information:
- Name: ${contact.name}
- Company: ${contact.company || 'Unknown'}
- Title: ${contact.title || 'Unknown'}
- Notes: ${contact.notes || 'None'}
- Career history: ${careerStr}
- Education: ${eduStr}
- Relationship strength: ${relationship?.strength || 'Unknown'}/5
- How we met: ${relationship?.how_met || 'Unknown'}
- Recent interactions: ${interactionStr}

Write 2-3 sentences summarizing:
1. Who this person is professionally (current role and background)
2. Your relationship context and strength
3. Any notable points for future interactions

Keep it concise and useful for quick reference. Write in Traditional Chinese (繁體中文).`

  const result = await model.generateContent(prompt)
  return result.response.text().trim()
}

/**
 * Suggest next interaction for a contact
 */
export async function suggestInteraction(
  contact: any,
  recentInteractions: any[],
  relationship: any
): Promise<{ type: string; suggestion: string; timing: string; reason: string }> {
  if (!model) {
    throw new Error('Gemini AI not initialized')
  }

  const lastInteraction = recentInteractions[0]
  const daysSinceLastInteraction = lastInteraction
    ? Math.floor((Date.now() - new Date(lastInteraction.occurred_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const prompt = `Suggest the next interaction with this contact for relationship nurturing.

Contact:
- Name: ${contact.name}
- Company: ${contact.company || 'Unknown'}
- Title: ${contact.title || 'Unknown'}
- Relationship strength: ${relationship?.strength || 3}/5
- Relationship type: ${relationship?.relationship_type || 'professional'}
- Days since last interaction: ${daysSinceLastInteraction !== null ? daysSinceLastInteraction : 'Never interacted'}
- Recent interactions: ${recentInteractions.slice(0, 3).map(i => `${i.type}: ${i.notes || 'No notes'}`).join('; ') || 'None'}

Return a JSON response with:
{
  "type": "meeting|call|message|email",
  "suggestion": "Specific action to take (in Traditional Chinese)",
  "timing": "When to do this (e.g., 'This week', 'Within 2 weeks')",
  "reason": "Why this suggestion (in Traditional Chinese)"
}

Consider:
- Relationship strength (stronger = more personal touch)
- Time since last interaction (longer = more urgent)
- Professional context (industry-appropriate suggestions)
- Variety in interaction types

Return ONLY valid JSON, no markdown.`

  const result = await model.generateContent(prompt)
  let responseText = result.response.text().trim()

  // Clean up response
  if (responseText.startsWith('```')) {
    responseText = responseText.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
  }

  try {
    return JSON.parse(responseText)
  } catch (e) {
    // Return default suggestion if parsing fails
    return {
      type: 'message',
      suggestion: '發送一則問候訊息，詢問近況',
      timing: 'This week',
      reason: '保持聯繫，維護關係'
    }
  }
}

/**
 * Infer relationships between contacts based on career and education overlap
 */
export async function inferRelationships(
  contacts: any[],
  careerData: { [contactId: string]: any[] },
  educationData: { [contactId: string]: any[] }
): Promise<{ contactAId: string; contactBId: string; relationshipType: string; confidence: number; reasoning: string }[]> {
  if (!model) {
    throw new Error('Gemini AI not initialized')
  }

  const inferences: { contactAId: string; contactBId: string; relationshipType: string; confidence: number; reasoning: string }[] = []

  // Check all pairs of contacts
  for (let i = 0; i < contacts.length; i++) {
    for (let j = i + 1; j < contacts.length; j++) {
      const contactA = contacts[i]
      const contactB = contacts[j]

      const careerA = careerData[contactA.id] || []
      const careerB = careerData[contactB.id] || []
      const eduA = educationData[contactA.id] || []
      const eduB = educationData[contactB.id] || []

      // Check for company overlap (current or past)
      const companiesA = new Set([
        contactA.company?.toLowerCase(),
        ...careerA.map((c: any) => c.company?.toLowerCase())
      ].filter(Boolean))

      const companiesB = new Set([
        contactB.company?.toLowerCase(),
        ...careerB.map((c: any) => c.company?.toLowerCase())
      ].filter(Boolean))

      const sharedCompanies = [...companiesA].filter(c => companiesB.has(c))

      // Check for school overlap
      const schoolsA = new Set(eduA.map((e: any) => e.school?.toLowerCase()).filter(Boolean))
      const schoolsB = new Set(eduB.map((e: any) => e.school?.toLowerCase()).filter(Boolean))
      const sharedSchools = [...schoolsA].filter(s => schoolsB.has(s))

      // Generate inference if there's overlap
      if (sharedCompanies.length > 0 || sharedSchools.length > 0) {
        let relationshipType = 'professional'
        let confidence = 0.5
        let reasoning = ''

        if (sharedCompanies.length > 0) {
          // Check if currently at same company
          if (contactA.company?.toLowerCase() === contactB.company?.toLowerCase()) {
            relationshipType = 'colleague'
            confidence = 0.85
            reasoning = `Both currently work at ${contactA.company}`
          } else {
            relationshipType = 'former_colleague'
            confidence = 0.7
            reasoning = `Both worked at ${sharedCompanies[0]}`
          }
        }

        if (sharedSchools.length > 0) {
          // School connection (may be in addition to work connection)
          if (relationshipType === 'professional') {
            relationshipType = 'classmate'
            confidence = 0.65
          } else {
            confidence = Math.min(0.95, confidence + 0.1) // Boost if both work and school
          }
          reasoning += (reasoning ? '; ' : '') + `Both attended ${sharedSchools[0]}`
        }

        inferences.push({
          contactAId: contactA.id,
          contactBId: contactB.id,
          relationshipType,
          confidence,
          reasoning
        })
      }
    }
  }

  return inferences
}

// ==================== v1.2 AI Features ====================

/**
 * Helper to clean JSON from Gemini responses
 */
function cleanJsonResponse(text: string): string {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/```json?\n?/g, '').replace(/```$/g, '').trim()
  }
  return cleaned
}

/**
 * Analyze relationship health for a batch of contacts
 */
export async function analyzeRelationshipHealth(
  contacts: { id: string; name: string; company?: string; title?: string }[],
  interactionMap: Record<string, { type: string; occurred_at: string; notes?: string }[]>,
  relationshipMap: Record<string, { strength: number; relationship_type?: string; how_met?: string }>,
  locale?: string
): Promise<{
  contactId: string
  healthScore: number
  daysSinceInteraction: number | null
  avgFrequencyDays: number | null
  suggestedAction: string
  suggestedMessage: string
  priority: 'urgent' | 'due' | 'maintain' | 'healthy'
}[]> {
  if (!model) throw new Error('Gemini AI not initialized')

  const results: any[] = []
  const now = Date.now()

  for (const contact of contacts) {
    const interactions = interactionMap[contact.id] || []
    const relationship = relationshipMap[contact.id]
    const strength = relationship?.strength || 3

    // Deterministic health score calculation
    let daysSince: number | null = null
    let avgFreq: number | null = null

    if (interactions.length > 0) {
      const sorted = interactions.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
      daysSince = Math.floor((now - new Date(sorted[0].occurred_at).getTime()) / (1000 * 60 * 60 * 24))

      if (sorted.length >= 2) {
        const first = new Date(sorted[sorted.length - 1].occurred_at).getTime()
        const last = new Date(sorted[0].occurred_at).getTime()
        avgFreq = Math.round((last - first) / (1000 * 60 * 60 * 24) / (sorted.length - 1))
      }
    }

    // Score calculation
    let score = 100
    const expectedFreq = avgFreq || (strength >= 4 ? 14 : strength >= 3 ? 30 : 60)

    if (daysSince !== null) {
      const overdueFactor = daysSince / expectedFreq
      if (overdueFactor > 2) score -= 60
      else if (overdueFactor > 1.5) score -= 40
      else if (overdueFactor > 1) score -= 20
      else score -= Math.round(overdueFactor * 10)
    } else {
      score = 30 // Never interacted
    }

    // Boost for strong relationships
    score = Math.max(0, Math.min(100, score + (strength - 3) * 5))

    const priority = score < 30 ? 'urgent' : score < 50 ? 'due' : score < 75 ? 'maintain' : 'healthy'

    results.push({
      contactId: contact.id,
      healthScore: score,
      daysSinceInteraction: daysSince,
      avgFrequencyDays: avgFreq,
      priority,
      _contact: contact,
      _interactions: interactions.slice(0, 3),
      _relationship: relationship,
    })
  }

  // Generate AI suggestions only for urgent + due contacts (to save API calls)
  const needsSuggestion = results.filter(r => r.priority === 'urgent' || r.priority === 'due')

  if (needsSuggestion.length > 0 && model) {
    const langInstruction = getLocaleInstruction(locale)
    const contactList = needsSuggestion.map(r => {
      const c = r._contact
      const rel = r._relationship
      return `- ${c.name} (${c.company || 'unknown'}, ${c.title || 'unknown'}): strength ${rel?.strength || '?'}/5, ${r.daysSinceInteraction !== null ? `last contact ${r.daysSinceInteraction} days ago` : 'never contacted'}, priority: ${r.priority}`
    }).join('\n')

    const prompt = `You are a relationship coaching AI for a CRM app. For each contact below, provide a brief suggested action and a short outreach message draft.

Contacts needing attention:
${contactList}

${langInstruction}

Return a JSON array with one object per contact:
[
  {
    "name": "Contact name",
    "suggestedAction": "Brief action suggestion (1 sentence)",
    "suggestedMessage": "Short outreach message draft (2-3 sentences)"
  }
]

Rules:
- Return ONLY valid JSON, no markdown
- Make suggestions specific and actionable
- Messages should feel warm and natural, not robotic
- Consider relationship strength and time gap`

    try {
      const result = await model.generateContent(prompt)
      const parsed = JSON.parse(cleanJsonResponse(result.response.text()))

      for (const suggestion of parsed) {
        const match = needsSuggestion.find(r => r._contact.name === suggestion.name)
        if (match) {
          match.suggestedAction = suggestion.suggestedAction
          match.suggestedMessage = suggestion.suggestedMessage
        }
      }
    } catch (e) {
      console.error('Failed to generate relationship coach suggestions:', e)
    }
  }

  // Fill defaults for contacts without AI suggestions
  return results.map(r => ({
    contactId: r.contactId,
    healthScore: r.healthScore,
    daysSinceInteraction: r.daysSinceInteraction,
    avgFrequencyDays: r.avgFrequencyDays,
    suggestedAction: r.suggestedAction || '',
    suggestedMessage: r.suggestedMessage || '',
    priority: r.priority,
  }))
}

/**
 * Generate a pre-meeting brief for a contact
 */
export async function generateMeetingBrief(
  contact: any,
  careerHistory: any[],
  educationHistory: any[],
  interactions: any[],
  relationship: any,
  mutualContacts: { name: string; company?: string }[],
  locale?: string
): Promise<{
  summary: string
  talkingPoints: string[]
  relationshipContext: string
  lastInteractionRecap: string
  mutualConnections: string
}> {
  if (!model) throw new Error('Gemini AI not initialized')

  const langInstruction = getLocaleInstruction(locale)

  const careerStr = careerHistory.length > 0
    ? careerHistory.map(c => `${c.title || 'Role'} at ${c.company} (${c.start_date || '?'} - ${c.end_date || 'present'})`).join('; ')
    : 'Unknown'

  const eduStr = educationHistory.length > 0
    ? educationHistory.map(e => `${e.degree || ''} ${e.field || ''} from ${e.school}`).join('; ')
    : 'Unknown'

  const recentInteractions = interactions.slice(0, 5).map(i =>
    `${i.type} on ${i.occurred_at}: ${i.notes || 'No notes'}`
  ).join('\n')

  const mutualStr = mutualContacts.length > 0
    ? mutualContacts.map(m => `${m.name} (${m.company || ''})`).join(', ')
    : 'None found'

  const prompt = `Generate a pre-meeting brief for this contact.

Contact:
- Name: ${contact.name}
- Company: ${contact.company || 'Unknown'}
- Title: ${contact.title || 'Unknown'}
- Notes: ${contact.notes || 'None'}
- Career: ${careerStr}
- Education: ${eduStr}
- Relationship strength: ${relationship?.strength || '?'}/5
- How we met: ${relationship?.how_met || 'Unknown'}
- Mutual connections: ${mutualStr}

Recent interactions:
${recentInteractions || 'No recorded interactions'}

${langInstruction}

Return a JSON object:
{
  "summary": "2-3 sentence professional summary of who this person is",
  "talkingPoints": ["3-5 specific talking points for the meeting"],
  "relationshipContext": "1-2 sentences about your relationship history",
  "lastInteractionRecap": "Brief recap of last interaction, or 'No previous interactions'",
  "mutualConnections": "Brief note about mutual connections"
}

Rules:
- Return ONLY valid JSON, no markdown
- Make talking points specific and relevant
- Be concise but informative`

  const result = await model.generateContent(prompt)
  return JSON.parse(cleanJsonResponse(result.response.text()))
}

/**
 * Process a post-meeting follow-up note
 */
export async function processMeetingFollowUp(
  contact: any,
  noteText: string,
  locale?: string
): Promise<{
  cleanedNotes: string
  actionItems: { task: string; dueDate?: string }[]
  interactionType: string
  followUpSuggestion: { note: string; daysFromNow: number } | null
}> {
  if (!model) throw new Error('Gemini AI not initialized')

  const langInstruction = getLocaleInstruction(locale)

  const prompt = `Process this post-meeting note and extract structured information.

Contact: ${contact.name} (${contact.company || ''}, ${contact.title || ''})
Meeting note from user:
"${noteText}"

${langInstruction}

Return a JSON object:
{
  "cleanedNotes": "Clean, well-formatted version of the meeting notes",
  "actionItems": [
    { "task": "Action item description", "dueDate": "YYYY-MM-DD or null" }
  ],
  "interactionType": "meeting|call|message|email|other",
  "followUpSuggestion": {
    "note": "Suggested follow-up reminder text",
    "daysFromNow": 7
  }
}

Rules:
- Return ONLY valid JSON, no markdown
- Extract ALL action items mentioned
- Infer due dates from context (e.g., "next week" = 7 days)
- If no follow-up needed, set followUpSuggestion to null
- Determine the most likely interaction type from context`

  const result = await model.generateContent(prompt)
  return JSON.parse(cleanJsonResponse(result.response.text()))
}

/**
 * Analyze interaction patterns and suggest smart reminders
 */
export async function analyzeInteractionPatterns(
  contacts: { id: string; name: string; company?: string; strength: number }[],
  interactionMap: Record<string, { type: string; occurred_at: string }[]>,
  locale?: string
): Promise<{
  contactId: string
  suggestionText: string
  reason: string
  suggestedDate: string
  confidence: number
}[]> {
  if (!model) throw new Error('Gemini AI not initialized')

  const now = Date.now()
  const suggestions: any[] = []

  // Find overdue contacts based on interaction patterns
  const overdueContacts: { contact: any; daysSince: number; avgFreq: number; overdueFactor: number }[] = []

  for (const contact of contacts) {
    const interactions = interactionMap[contact.id] || []
    if (interactions.length === 0) {
      // Never interacted with strong contact — suggest
      if (contact.strength >= 3) {
        overdueContacts.push({ contact, daysSince: -1, avgFreq: 30, overdueFactor: 2 })
      }
      continue
    }

    const sorted = interactions.sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    const daysSince = Math.floor((now - new Date(sorted[0].occurred_at).getTime()) / (1000 * 60 * 60 * 24))

    let avgFreq: number
    if (sorted.length >= 2) {
      const first = new Date(sorted[sorted.length - 1].occurred_at).getTime()
      const last = new Date(sorted[0].occurred_at).getTime()
      avgFreq = Math.round((last - first) / (1000 * 60 * 60 * 24) / (sorted.length - 1))
    } else {
      avgFreq = contact.strength >= 4 ? 14 : contact.strength >= 3 ? 30 : 60
    }

    const overdueFactor = daysSince / Math.max(avgFreq, 1)
    if (overdueFactor >= 1.3) {
      overdueContacts.push({ contact, daysSince, avgFreq, overdueFactor })
    }
  }

  if (overdueContacts.length === 0) return []

  // Sort by overdue factor descending and take top 10
  overdueContacts.sort((a, b) => b.overdueFactor - a.overdueFactor)
  const top = overdueContacts.slice(0, 10)

  const langInstruction = getLocaleInstruction(locale)
  const contactList = top.map(o => {
    const c = o.contact
    if (o.daysSince === -1) {
      return `- ${c.name} (${c.company || '?'}): strength ${c.strength}/5, never contacted`
    }
    return `- ${c.name} (${c.company || '?'}): strength ${c.strength}/5, last contact ${o.daysSince} days ago, usual frequency every ${o.avgFreq} days`
  }).join('\n')

  const prompt = `You are a smart reminder AI. For each overdue contact, suggest a follow-up reminder.

Overdue contacts:
${contactList}

${langInstruction}

Return a JSON array:
[
  {
    "name": "Contact name",
    "suggestionText": "What to remind the user to do (1 sentence)",
    "reason": "Why this reminder (1 sentence)",
    "daysFromNow": 1
  }
]

Rules:
- Return ONLY valid JSON, no markdown
- Be specific about what action to take
- daysFromNow should be 1-7 (more urgent = sooner)
- Reason should reference the interaction gap`

  try {
    const result = await model.generateContent(prompt)
    const parsed = JSON.parse(cleanJsonResponse(result.response.text()))

    for (const suggestion of parsed) {
      const match = top.find(o => o.contact.name === suggestion.name)
      if (match) {
        const suggestedDate = new Date(now + (suggestion.daysFromNow || 3) * 24 * 60 * 60 * 1000)
        suggestions.push({
          contactId: match.contact.id,
          suggestionText: suggestion.suggestionText,
          reason: suggestion.reason,
          suggestedDate: suggestedDate.toISOString(),
          confidence: Math.min(0.95, 0.5 + match.overdueFactor * 0.15),
        })
      }
    }
  } catch (e) {
    console.error('Failed to generate smart reminder suggestions:', e)
  }

  return suggestions
}
