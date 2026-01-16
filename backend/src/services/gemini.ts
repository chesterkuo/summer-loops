import { GoogleGenerativeAI } from '@google/generative-ai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

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
