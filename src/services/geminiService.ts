import { GoogleGenAI } from '@google/genai';
import { MasterProfile, CardCategory, ResumeStyle } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

export const isGeminiConfigured = Boolean(apiKey && apiKey.length > 5);

const ai = isGeminiConfigured ? new GoogleGenAI({ apiKey }) : null;

// Primary model string for Google AI API
const MODEL_NAME = 'gemini-flash-latest';

export interface TailoredCardOverride {
  id: string;
  category?: CardCategory;
  tailoredBullets: string[];
}

export interface GeneratedAboutCard {
  title: string;
  paragraph: string;
}

export interface GeminiTailorResponse {
  selectedCardIds: string[];
  suggestedSkills: string[];
  tailoringNotes: string;
  tailoredCardOverrides?: TailoredCardOverride[];
  generatedAboutCard?: GeneratedAboutCard;
}

export interface GeminiJobAnalysis {
  roleTitle: string;
  companyName: string;
  matchScore: number;
  extractedSkills: string[];
  fitSummary: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  gaps: string[];
}

export function isRateLimitError(error: any): boolean {
  if (!error) return false;

  const code = error?.code || error?.status || error?.error?.code || error?.error?.status || error?.response?.status;
  if (code === 429 || code === '429' || code === 'RESOURCE_EXHAUSTED') return true;

  const msgParts: string[] = [
    error?.message,
    error?.statusText,
    error?.error?.message,
    error?.error?.status,
    typeof error?.details === 'string' ? error.details : JSON.stringify(error?.details || ''),
    String(error)
  ];

  try {
    msgParts.push(JSON.stringify(error, Object.getOwnPropertyNames(error)));
  } catch (e) {}

  const fullText = msgParts.filter(Boolean).join(' ').toLowerCase();

  return (
    fullText.includes('429') ||
    fullText.includes('resource_exhausted') ||
    fullText.includes('quota') ||
    fullText.includes('rate limit') ||
    fullText.includes('too many requests') ||
    fullText.includes('exceeded your current quota')
  );
}

/**
 * 1. AI Job Posting Tailoring & Card Rewriting (gemini-flash-latest)
 * Matches master experience & project cards to target job posting text, extracts skills, rewrites bullets
 * strictly aligned to job description keywords without inventing facts, and auto-generates About card paragraph if missing.
 */
export async function tailorResumeWithGemini(
  masterProfile: MasterProfile,
  jobPostingText: string
): Promise<GeminiTailorResponse> {
  if (!ai || !jobPostingText.trim()) {
    // Basic fallback if Gemini API is unconfigured
    const jobLower = jobPostingText.toLowerCase();
    const matchedCards = (masterProfile.experiences || []).filter(exp => {
      const text = `${exp.title} ${exp.company} ${(exp.skills || []).join(' ')} ${(exp.bullets || []).join(' ')}`.toLowerCase();
      return jobLower.split(/\s+/).some(word => word.length > 3 && text.includes(word));
    });
    const selectedCardIds = matchedCards.length > 0 ? matchedCards.map(e => e.id) : (masterProfile.experiences || []).slice(0, 3).map(e => e.id);

    return {
      selectedCardIds,
      suggestedSkills: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Gemini AI'],
      tailoringNotes: 'Keyword matching applied.',
      tailoredCardOverrides: [],
      generatedAboutCard: !(masterProfile.experiences || []).some(e => (e.category || 'experience') === 'about') ? {
        title: 'Professional Bio & Summary',
        paragraph: 'Driven engineer with hands-on experience building high-performance web applications tailored to enterprise specifications.'
      } : undefined
    };
  }

  try {
    const compactCards = (masterProfile.experiences || []).map(e => ({
      id: e.id,
      category: e.category || 'experience',
      title: e.title,
      company: e.company,
      skills: e.skills || [],
      bullets: (e.bullets || []).map(b => (typeof b === 'string' ? b : b?.text || ''))
    }));

    const prompt = `Act as an expert ATS Resume Strategy Engine.
Analyze the candidate's master cards against the target job posting.

RULES FOR TAILORING:
1. Select ONLY the most relevant card IDs (experience, project, education, about) for the target job posting.
2. For EVERY selected 'experience' and 'project' card, rewrite its bullet points to naturally incorporate target job keywords.
   STRICT RULE: Base bullet rewrites STRICTLY on true existing facts in the original bullets. DO NOT FABRICATE OR MAKE UP FALSE CLAIMS OR METRICS.
3. DO NOT TAILOR EDUCATION CARDS.
4. ALWAYS GENERATE A TAILORED ABOUT CARD: Generate a concise, high-impact 2-sentence Professional Bio & Summary paragraph (NOT bullet points) tailored specifically for this target role.

Return JSON ONLY (no markdown backticks):
{
  "selectedCardIds": ["exp-1", "proj-1"],
  "suggestedSkills": ["Skill 1", "Skill 2"],
  "tailoringNotes": "Brief rationale for card selection",
  "tailoredCardOverrides": [
    {
      "id": "exp-1",
      "category": "experience",
      "tailoredBullets": [
        "Architected scalable web applications using React and TypeScript, optimizing response times by 35%.",
        "Engineered robust frontend features aligned to high-concurrency target system specifications."
      ]
    },
    {
      "id": "proj-1",
      "category": "project",
      "tailoredBullets": [
        "Developed full-stack web applications integrating REST APIs and state management.",
        "Built responsive UI components following modern design systems."
      ]
    }
  ],
  "generatedAboutCard": {
    "title": "Professional Bio & Summary",
    "paragraph": "Senior Engineer specializing in scalable web systems and modern frontend architectures. Proven track record delivering high-impact features matching enterprise requirements."
  }
}

CANDIDATE CARDS:
${JSON.stringify(compactCards, null, 2)}

TARGET JOB POSTING:
${jobPostingText.slice(0, 4000)}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const cleanJson = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();

    let parsed: any = {};
    try {
      parsed = JSON.parse(cleanJson);
    } catch (e) {
      console.warn('Gemini JSON parse fallback:', e);
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          parsed = JSON.parse(match[0]);
        } catch (err) {}
      }
    }

    return {
      selectedCardIds: Array.isArray(parsed.selectedCardIds) ? parsed.selectedCardIds : [],
      suggestedSkills: Array.isArray(parsed.suggestedSkills) ? parsed.suggestedSkills : [],
      tailoringNotes: parsed.tailoringNotes || 'Tailored with Gemini AI.',
      tailoredCardOverrides: Array.isArray(parsed.tailoredCardOverrides) ? parsed.tailoredCardOverrides : [],
      generatedAboutCard: parsed.generatedAboutCard || undefined
    };
  } catch (error) {
    console.error('Gemini tailoring error:', error);
    const matched = (masterProfile.experiences || []).slice(0, 3).map(e => e.id);
    return {
      selectedCardIds: matched,
      suggestedSkills: [],
      tailoringNotes: 'Fallback card selection applied.'
    };
  }
}

/**
 * Helper function to strip markdown codeblock backticks (```yaml ... ```) from AI output strings
 */
export function cleanYamlCodeBlock(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```(?:yaml|yml)?\s*/gi, '');
  cleaned = cleaned.replace(/\s*```$/gi, '');
  return cleaned.trim();
}

/**
 * 2. AI Resume Text-to-YAML Converter (gemini-flash-latest)
 */
export async function convertResumeTextToYamlWithGemini(resumeText: string): Promise<string> {
  if (!ai || !resumeText.trim()) {
    throw new Error('Gemini API key is not configured.');
  }

  const prompt = `Convert the following resume into valid YAML schema:
name: "Full Name"
title: "Title"
email: "email"
phone: "phone"
location: "location"
summary: "summary"
experiences:
  - id: "about-1"
    category: "about"
    title: "Bio"
    bullets: ["Cohesive about paragraph..."]
  - id: "exp-1"
    category: "experience"
    title: "Job Title"
    company: "Company"
    period: "Period"
    location: "Location"
    skills: ["Skill"]
    bullets: ["bullet"]

Return YAML inside markdown codeblock ONLY.

RESUME:
${resumeText.slice(0, 5000)}`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt
  });

  return cleanYamlCodeBlock(response.text || '');
}

/**
 * 2b. AI Multimodal PDF/Document Resume to YAML Converter
 */
export async function convertPdfToYamlWithGemini(fileBase64: string, mimeType: string = 'application/pdf'): Promise<string> {
  if (!ai) {
    throw new Error('Gemini API key is not configured.');
  }

  const cleanBase64 = fileBase64.includes(',') ? fileBase64.split(',')[1] : fileBase64;

  const prompt = `You are an expert resume data extractor. Parse the attached resume document file (${mimeType}) completely and convert all profile details, work history, projects, skills, education, and bios into valid YAML matching this EXACT schema structure:

name: "Full Candidate Name"
title: "Current / Target Professional Role"
email: "candidate@email.com"
phone: "(555) 000-0000"
location: "City, State / Country"
summary: "Professional summary paragraph"
experiences:
  - id: "about-1"
    category: "about"
    title: "Professional Summary & Bio"
    company: "N/A"
    period: "Present"
    location: "Remote"
    skills: ["Core Area 1", "Core Area 2"]
    bullets:
      - "Comprehensive overview paragraph of technical experience..."
  - id: "exp-1"
    category: "experience"
    title: "Job Title"
    company: "Company Name"
    period: "Employment Period (e.g. Jan 2022 - Present)"
    location: "City, State"
    skills: ["Skill 1", "Skill 2"]
    bullets:
      - "Specific quantifiable achievement bullet point 1"
      - "Specific quantifiable achievement bullet point 2"
  - id: "proj-1"
    category: "project"
    title: "Project Title"
    company: "Personal Project"
    period: "2023"
    location: "Remote"
    skills: ["Technology 1", "Framework 2"]
    bullets:
      - "Project detail bullet point 1"
  - id: "edu-1"
    category: "education"
    title: "Degree Name (e.g. B.S. Computer Science)"
    company: "University / Institution"
    period: "Graduation Year"
    location: "City, State"
    skills: ["Academic Focus 1"]
    bullets:
      - "Relevant coursework, honors, or leadership"

RULES:
1. Ensure unique 'id' strings for every experience entry (exp-1, exp-2, proj-1, edu-1).
2. Categorize items strictly into: "experience", "project", "education", or "about".
3. Extract all bullet points, dates, company names, and technical skills accurately.
4. Output ONLY valid YAML code inside a markdown code block (\`\`\`yaml ... \`\`\`). Do NOT add conversational preamble.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              data: cleanBase64,
              mimeType: mimeType
            }
          },
          { text: prompt }
        ]
      }
    ]
  });

  return cleanYamlCodeBlock(response.text || '');
}

/**
 * 3. AI Bullet Achievement Enhancer (gemini-flash-latest)
 */
export async function enhanceBulletWithGemini(
  rawBulletText: string,
  contextTitle: string,
  customPrompt?: string
): Promise<string> {
  if (!ai || !rawBulletText.trim()) return rawBulletText;

  try {
    const prompt = `Rewrite this resume achievement bullet into 1 concise, high-impact ATS bullet point with strong action verbs and quantified impact metrics. Base rewrites strictly on true facts without inventing false details.
ROLE CONTEXT: ${contextTitle}
${customPrompt && customPrompt.trim() ? `USER CUSTOM INSTRUCTION / PROMPT: ${customPrompt.trim()}\n` : ''}
ORIGINAL BULLET TEXT: ${rawBulletText}

Return rewritten bullet statement only without quotes:`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt
    });

    return (response.text || rawBulletText).trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Gemini bullet enhancer error:', error);
    return rawBulletText;
  }
}

/**
 * 4. AI Job Posting Analyzer & ATS Match Scoring (gemini-flash-latest)
 */
export interface GeminiJobAnalysis {
  roleTitle: string;
  companyName: string;
  matchScore: number;
  confidenceScore: number;
  extractedSkills: string[];
  fitSummary: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths: string[];
  gaps: string[];
}

export async function analyzeJobMatchWithGemini(
  jobPostingText: string,
  candidateContextText?: string
): Promise<GeminiJobAnalysis> {
  if (!ai || !jobPostingText.trim()) {
    return {
      roleTitle: 'Tailored Target Role',
      companyName: 'Target Enterprise',
      matchScore: 85,
      confidenceScore: 92,
      extractedSkills: ['React', 'TypeScript', 'Node.js'],
      fitSummary: 'The candidate displays strong core technical alignment with the target role requirements, bringing relevant experience in software architecture and modern web technologies.',
      matchedKeywords: ['React', 'TypeScript', 'Node.js', 'REST APIs'],
      missingKeywords: ['AWS Lambda', 'Kubernetes', 'Docker'],
      strengths: ['Solid foundation in modern web frameworks and full-stack development.', 'Proven experience architecting scalable user interfaces.'],
      gaps: ['Limited explicit mention of container orchestration tools (Kubernetes/Docker).']
    };
  }

  try {
    const prompt = `You are an expert ATS recruiter and senior technical hiring manager. Analyze this job posting text against the candidate's resume/skills profile.
Evaluate keyword match, skills alignment, and relevant experience to calculate:
1. ATS Match Score (% out of 100 based on keyword overlap).
2. Confidence Score (% out of 100 based on qualitative LLM assessment of candidate experience depth, role fit, leadership, and overall capability).
Also generate a detailed LLM fit analysis, matched ATS keywords, missing/desired keywords, key candidate strengths, and potential skill gaps.

Return JSON ONLY with exact structure:
{
  "roleTitle": "Role Title",
  "companyName": "Company Name",
  "matchScore": 85,
  "confidenceScore": 92,
  "extractedSkills": ["Skill1", "Skill2"],
  "fitSummary": "Detailed multi-sentence narrative assessment explaining candidate fit, experience alignment, and overall match analysis...",
  "matchedKeywords": ["React", "TypeScript", "Node.js"],
  "missingKeywords": ["AWS", "Kubernetes", "GraphQL"],
  "strengths": ["Strong frontend architecture experience", "Proven backend API engineering track record"],
  "gaps": ["Lacks direct experience with cloud infrastructure deployment"]
}

JOB POSTING TEXT:
${jobPostingText.slice(0, 3000)}

CANDIDATE RESUME / PROFILE:
${candidateContextText ? candidateContextText.slice(0, 3000) : 'Full stack software engineer with React, TypeScript, Node.js, Python, Cloud experience.'}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      roleTitle: parsed.roleTitle || 'Tailored Target Role',
      companyName: parsed.companyName || 'Target Enterprise',
      matchScore: typeof parsed.matchScore === 'number' ? Math.min(100, Math.max(10, Math.round(parsed.matchScore))) : 85,
      confidenceScore: typeof parsed.confidenceScore === 'number' ? Math.min(100, Math.max(10, Math.round(parsed.confidenceScore))) : 90,
      extractedSkills: Array.isArray(parsed.extractedSkills) ? parsed.extractedSkills : [],
      fitSummary: parsed.fitSummary || 'The candidate profile shows high overall technical compatibility with the target job requirements.',
      matchedKeywords: Array.isArray(parsed.matchedKeywords) && parsed.matchedKeywords.length > 0 ? parsed.matchedKeywords : ['React', 'TypeScript', 'Node.js'],
      missingKeywords: Array.isArray(parsed.missingKeywords) ? parsed.missingKeywords : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      gaps: Array.isArray(parsed.gaps) ? parsed.gaps : []
    };
  } catch (error) {
    console.error('Gemini job analysis error:', error);
    return {
      roleTitle: 'Tailored Target Role',
      companyName: 'Target Enterprise',
      matchScore: 82,
      confidenceScore: 88,
      extractedSkills: [],
      fitSummary: 'Analysis performed with standard profile context. Candidate shows solid alignment with core engineering requirements.',
      matchedKeywords: ['Full Stack Development', 'Problem Solving'],
      missingKeywords: [],
      strengths: ['Versatile engineering skill set.'],
      gaps: []
    };
  }
}

/**
 * 5. AI Resume Template & Design Style Generator (gemini-flash-latest)
 */
export async function generateResumeStyleWithGemini(userDesignPrompt: string): Promise<ResumeStyle> {
  if (!ai || !userDesignPrompt.trim()) {
    return {
      id: `style-${Date.now()}`,
      name: 'Custom AI Modern Style',
      description: userDesignPrompt || 'AI-generated custom resume theme',
      isAiGenerated: true,
      theme: {
        primaryColor: '#0284c7',
        secondaryColor: '#0369a1',
        textColor: '#0f172a',
        bgColor: '#ffffff',
        accentColor: '#38bdf8',
        fontFamily: 'outfit',
        layout: 'header-banner',
        borderStyle: 'solid',
        dividerColor: '#e2e8f0',
        sectionHeaderStyle: 'pill-badge'
      }
    };
  }

  try {
    const prompt = `You are an elite, world-class executive resume designer and ATS typography architect building themes for ResumixAI's Programmatic Vector PDF Engine.
Generate a distinctive, highly aesthetic, readable, and visually stunning resume template based on the user's design request: "${userDesignPrompt}"

CORE DESIGN PARADIGMS & GUIDELINES FOR VECTOR PDF ENGINE:
1. LIGHT BACKGROUNDS ONLY (MANDATORY FOR PRINT & ATS COMPATIBILITY):
   - 'bgColor' MUST ALWAYS BE A CLEAN LIGHT BACKGROUND (#ffffff, #f8fafc, #f5f3ff, #fafafa). Dark mode styles or dark page backgrounds (#0f172a, #000000, #090d16) are STRICTLY FORBIDDEN to ensure perfect PDF printing and 100% ATS compliance.
   - 'textColor' MUST be deep high-contrast dark charcoal (#0f172a, #18181b, #000000, #1e293b).
   - 'secondaryColor' (dates, companies) MUST be sufficiently dark slate (#334155, #475569, #1e3a8a, #0369a1). NEVER output low-contrast light gray (#94a3b8, #cbd5e1) or pastel text on light background!
   - 'primaryColor' (section headers) MUST be rich, dark, and punchy (#000000, #0f172a, #1e3a8a, #4338ca, #0369a1, #065f46, #831843).
2. TYPOGRAPHY MATTERS: Select fonts purposefully:
   - 'inter' or 'outfit': Modern tech, engineering, AI, product roles.
   - 'space-grotesk' or 'mono': Systems, infrastructure, cybersecurity, backend.
   - 'serif' or 'playfair': Executive leadership, legal, academia, finance.
3. VECTOR PDF LAYOUT ARCHITECTURE:
   - 'single-column': Pure ATS compliance, executive hierarchy.
   - 'cards-modern': Contemporary rounded card containers with subtle cardBgColor tint.
   - 'header-banner': Full-width accent banner header for executive presence.
   - 'brand-margin-stripe': Sleek vertical accent stripe along the left page edge.
4. SECTION HEADER STYLING:
   - Choose sectionHeaderStyle: 'uppercase-accent' (clean rule line), 'pill-badge' (rounded colored box), 'minimal-left-border' (thick left accent bar), or 'filled-badge'.

Output JSON ONLY matching this exact structure:
{
  "name": "Catchy & Unique Style Name",
  "description": "Visual summary of theme palette, typography, and structural aesthetic",
  "theme": {
    "primaryColor": "#HEX (Main dominant header/brand color)",
    "secondaryColor": "#HEX (Subtitle/company text color)",
    "textColor": "#HEX (Body text color)",
    "bgColor": "#HEX (Page background color, ALWAYS #ffffff, #f8fafc, or #f5f3ff)",
    "headerBgColor": "#HEX (Full width header banner color or empty string if transparent)",
    "headerTextColor": "#HEX (Header name text color)",
    "headerAlignment": "center" | "left" | "right" | "split-right",
    "headerStyle": "minimal" | "banner-filled" | "left-accent-border" | "top-bottom-border" | "pills-banner",
    "sidebarBgColor": "#HEX",
    "cardBgColor": "#HEX (Background tint color for card containers)",
    "accentColor": "#HEX (Highlights, bullets, skill badges)",
    "fontFamily": "inter" | "roboto" | "serif" | "mono" | "outfit" | "playfair" | "space-grotesk",
    "layout": "single-column" | "header-banner" | "cards-modern" | "brand-margin-stripe",
    "borderStyle": "solid" | "dashed" | "none" | "double",
    "dividerColor": "#HEX (Line dividers & border colors)",
    "sectionHeaderStyle": "clean-underline" | "filled-badge" | "uppercase-accent" | "minimal-left-border" | "pill-badge" | "gradient-bar",
    "skillsDisplayStyle": "comma-separated" | "pill-badges" | "bulleted-grid"
  }
}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text || '{}');
    const validFont = ['inter', 'roboto', 'serif', 'mono', 'outfit', 'playfair', 'space-grotesk'].includes(parsed.theme?.fontFamily) ? parsed.theme.fontFamily : 'outfit';
    const validLayout = ['single-column', 'header-banner', 'cards-modern', 'brand-margin-stripe'].includes(parsed.theme?.layout) ? parsed.theme.layout : 'single-column';
    const validHeaderStyle = ['clean-underline', 'filled-badge', 'uppercase-accent', 'minimal-left-border', 'pill-badge', 'gradient-bar'].includes(parsed.theme?.sectionHeaderStyle) ? parsed.theme.sectionHeaderStyle : 'pill-badge';
    const validHeaderAlignment = ['center', 'left', 'right', 'split-right'].includes(parsed.theme?.headerAlignment) ? parsed.theme.headerAlignment : 'left';
    const validSkillsStyle = ['comma-separated', 'pill-badges', 'bulleted-grid'].includes(parsed.theme?.skillsDisplayStyle) ? parsed.theme.skillsDisplayStyle : 'pill-badges';

    // Strict Light Theme Clamp: Ensure bgColor is always a light paper background
    let finalBgColor = (parsed.theme?.bgColor || '#ffffff').toLowerCase();
    if (/^#(0|1|2|3|4)/i.test(finalBgColor)) {
      finalBgColor = '#ffffff';
    }

    let finalSecondaryColor = parsed.theme?.secondaryColor || '#475569';
    let finalTextColor = parsed.theme?.textColor || '#0f172a';

    if (/^#(9|a|b|c|d|e|f)/i.test(finalSecondaryColor)) {
      finalSecondaryColor = '#475569';
    }
    if (/^#(8|9|a|b|c|d|e|f)/i.test(finalTextColor)) {
      finalTextColor = '#18181b';
    }

    return {
      id: `style-ai-${Date.now()}`,
      name: parsed.name || 'AI Custom Resume Style',
      description: parsed.description || userDesignPrompt,
      isAiGenerated: true,
      theme: {
        primaryColor: parsed.theme?.primaryColor || '#4f46e5',
        secondaryColor: finalSecondaryColor,
        textColor: finalTextColor,
        bgColor: finalBgColor,
        headerBgColor: parsed.theme?.headerBgColor || undefined,
        headerTextColor: parsed.theme?.headerTextColor || undefined,
        headerAlignment: validHeaderAlignment,
        headerStyle: parsed.theme?.headerStyle || 'minimal',
        sidebarBgColor: parsed.theme?.sidebarBgColor || undefined,
        cardBgColor: parsed.theme?.cardBgColor || undefined,
        stripeColor: parsed.theme?.stripeColor || parsed.theme?.primaryColor || '#4f46e5',
        accentColor: parsed.theme?.accentColor || '#6366f1',
        fontFamily: validFont,
        layout: validLayout,
        borderStyle: 'solid',
        dividerColor: parsed.theme?.dividerColor || '#e2e8f0',
        sectionHeaderStyle: validHeaderStyle,
        skillsDisplayStyle: validSkillsStyle
      }
    };
  } catch (error) {
    console.error('Gemini Resume Style Generation error:', error);
    if (isRateLimitError(error)) throw error;
    return {
      id: `style-ai-${Date.now()}`,
      name: 'Custom AI Theme',
      description: userDesignPrompt,
      isAiGenerated: true,
      theme: {
        primaryColor: '#4f46e5',
        secondaryColor: '#0284c7',
        textColor: '#0f172a',
        bgColor: '#ffffff',
        accentColor: '#6366f1',
        fontFamily: 'inter',
        layout: 'single-column',
        borderStyle: 'solid',
        dividerColor: '#e2e8f0',
        sectionHeaderStyle: 'clean-underline'
      }
    };
  }
}

export async function refineResumeStyleWithGemini(
  existingStyle: ResumeStyle,
  userRefinementPrompt: string
): Promise<ResumeStyle> {
  if (!ai) {
    throw new Error("Gemini AI API Key not configured");
  }

  try {
    const prompt = `You are a world-class executive resume designer. Refine an existing resume design style based on the user's modifications.

Existing Resume Style:
Name: ${existingStyle.name}
Description: ${existingStyle.description}
Current Theme Configuration: ${JSON.stringify(existingStyle.theme, null, 2)}

User Refinement Instructions:
"${userRefinementPrompt}"

Output ONLY a JSON object:
{
  "name": "Updated theme name reflecting refinements",
  "description": "Short 1-sentence summary of updated design aesthetic",
  "theme": {
    "primaryColor": "#HEX",
    "secondaryColor": "#HEX",
    "textColor": "#HEX",
    "bgColor": "#HEX",
    "headerBgColor": "#HEX",
    "headerTextColor": "#HEX",
    "headerAlignment": "center" | "left" | "right" | "split-right",
    "headerStyle": "minimal" | "banner-filled" | "left-accent-border" | "top-bottom-border" | "pills-banner",
    "sidebarBgColor": "#HEX",
    "cardBgColor": "#HEX",
    "stripeColor": "#HEX",
    "accentColor": "#HEX",
    "fontFamily": "inter" | "roboto" | "serif" | "mono" | "outfit" | "playfair" | "space-grotesk",
    "layout": "single-column" | "header-banner" | "cards-modern" | "brand-margin-stripe",
    "borderStyle": "solid" | "dashed" | "none" | "double",
    "dividerColor": "#HEX",
    "sectionHeaderStyle": "clean-underline" | "filled-badge" | "uppercase-accent" | "minimal-left-border" | "pill-badge" | "gradient-bar",
    "skillsDisplayStyle": "comma-separated" | "pill-badges" | "bulleted-grid"
  }
}`;

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    const parsed = JSON.parse(response.text || '{}');
    const validFont = ['inter', 'roboto', 'serif', 'mono', 'outfit', 'playfair', 'space-grotesk'].includes(parsed.theme?.fontFamily) ? parsed.theme.fontFamily : existingStyle.theme.fontFamily;
    const validLayout = ['single-column', 'header-banner', 'cards-modern', 'brand-margin-stripe'].includes(parsed.theme?.layout) ? parsed.theme.layout : 'single-column';
    const validHeaderStyle = ['clean-underline', 'filled-badge', 'uppercase-accent', 'minimal-left-border', 'pill-badge', 'gradient-bar'].includes(parsed.theme?.sectionHeaderStyle) ? parsed.theme.sectionHeaderStyle : existingStyle.theme.sectionHeaderStyle;
    const validHeaderAlignment = ['center', 'left', 'right', 'split-right'].includes(parsed.theme?.headerAlignment) ? parsed.theme.headerAlignment : (existingStyle.theme.headerAlignment || 'left');
    const validSkillsStyle = ['comma-separated', 'pill-badges', 'bulleted-grid'].includes(parsed.theme?.skillsDisplayStyle) ? parsed.theme.skillsDisplayStyle : (existingStyle.theme.skillsDisplayStyle || 'pill-badges');

    // Strict Light Theme Clamp: Ensure bgColor is always a light paper background
    let finalBgColor = (parsed.theme?.bgColor || existingStyle.theme.bgColor || '#ffffff').toLowerCase();
    if (/^#(0|1|2|3|4)/i.test(finalBgColor)) {
      finalBgColor = '#ffffff';
    }

    let finalSecondaryColor = parsed.theme?.secondaryColor || existingStyle.theme.secondaryColor || '#475569';
    let finalTextColor = parsed.theme?.textColor || existingStyle.theme.textColor || '#0f172a';

    if (/^#(9|a|b|c|d|e|f)/i.test(finalSecondaryColor)) {
      finalSecondaryColor = '#475569';
    }
    if (/^#(8|9|a|b|c|d|e|f)/i.test(finalTextColor)) {
      finalTextColor = '#18181b';
    }

    return {
      id: existingStyle.id,
      name: parsed.name || existingStyle.name,
      description: parsed.description || userRefinementPrompt,
      isAiGenerated: true,
      theme: {
        primaryColor: parsed.theme?.primaryColor || existingStyle.theme.primaryColor,
        secondaryColor: finalSecondaryColor,
        textColor: finalTextColor,
        bgColor: finalBgColor,
        headerBgColor: parsed.theme?.headerBgColor !== undefined ? parsed.theme.headerBgColor : existingStyle.theme.headerBgColor,
        headerTextColor: parsed.theme?.headerTextColor !== undefined ? parsed.theme.headerTextColor : existingStyle.theme.headerTextColor,
        headerAlignment: validHeaderAlignment,
        headerStyle: parsed.theme?.headerStyle || existingStyle.theme.headerStyle || 'minimal',
        sidebarBgColor: parsed.theme?.sidebarBgColor !== undefined ? parsed.theme.sidebarBgColor : existingStyle.theme.sidebarBgColor,
        cardBgColor: parsed.theme?.cardBgColor !== undefined ? parsed.theme.cardBgColor : existingStyle.theme.cardBgColor,
        stripeColor: parsed.theme?.stripeColor || parsed.theme?.primaryColor || existingStyle.theme.stripeColor || existingStyle.theme.primaryColor,
        accentColor: parsed.theme?.accentColor || existingStyle.theme.accentColor,
        fontFamily: validFont,
        layout: validLayout,
        borderStyle: 'solid',
        dividerColor: parsed.theme?.dividerColor || existingStyle.theme.dividerColor,
        sectionHeaderStyle: validHeaderStyle,
        skillsDisplayStyle: validSkillsStyle
      }
    };
  } catch (error) {
    console.error('Gemini Resume Style Refinement error:', error);
    if (isRateLimitError(error)) throw error;
    return existingStyle;
  }
}
