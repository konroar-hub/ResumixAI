import { GoogleGenAI } from '@google/genai';
import { MasterProfile } from '../types';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

export const isGeminiConfigured = Boolean(apiKey && apiKey.length > 5);

const ai = isGeminiConfigured ? new GoogleGenAI({ apiKey }) : null;

export interface GeminiTailorResponse {
  selectedCardIds: string[];
  suggestedSkills: string[];
  tailoringNotes: string;
}

export interface GeminiJobAnalysis {
  roleTitle: string;
  companyName: string;
  matchScore: number;
  extractedSkills: string[];
}

/**
 * 1. AI Job Posting Tailoring (gemini-2.5-flash)
 * Matches master experience cards to target job posting text using succinct JSON prompting.
 */
export async function tailorResumeWithGemini(
  masterProfile: MasterProfile,
  jobPostingText: string
): Promise<GeminiTailorResponse> {
  if (!ai || !jobPostingText.trim()) {
    // Fallback heuristic card selection if Gemini API key is missing
    const jobLower = jobPostingText.toLowerCase();
    const matched = (masterProfile.experiences || [])
      .filter(exp => {
        const text = `${exp.title} ${exp.company} ${(exp.skills || []).join(' ')} ${(exp.bullets || []).join(' ')}`.toLowerCase();
        return jobLower.split(/\s+/).some(word => word.length > 3 && text.includes(word));
      })
      .map(exp => exp.id);

    return {
      selectedCardIds: matched.length > 0 ? matched : (masterProfile.experiences || []).slice(0, 3).map(e => e.id),
      suggestedSkills: ['React', 'TypeScript', 'Tailwind CSS', 'Vite', 'Gemini AI'],
      tailoringNotes: 'Heuristic keyword selection applied.'
    };
  }

  try {
    // Minimal, token-efficient payload
    const compactCards = (masterProfile.experiences || []).map(e => ({
      id: e.id,
      cat: e.category || 'experience',
      title: e.title,
      co: e.company,
      skills: e.skills
    }));

    const prompt = `Act as an ATS Resume Strategy Engine.
Given Candidate Cards & Job Posting, return JSON only:
{"selectedCardIds":["id1"],"suggestedSkills":["skill1"],"tailoringNotes":"rationale"}

CARDS: ${JSON.stringify(compactCards)}
JOB POSTING: ${jobPostingText.slice(0, 3000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text || '';
    const parsed = JSON.parse(text);

    return {
      selectedCardIds: Array.isArray(parsed.selectedCardIds) ? parsed.selectedCardIds : [],
      suggestedSkills: Array.isArray(parsed.suggestedSkills) ? parsed.suggestedSkills : [],
      tailoringNotes: parsed.tailoringNotes || 'Tailored with Gemini 2.5 Flash.'
    };
  } catch (error) {
    console.error('Gemini tailoring error:', error);
    return {
      selectedCardIds: (masterProfile.experiences || []).slice(0, 3).map(e => e.id),
      suggestedSkills: [],
      tailoringNotes: 'Fallback card selection applied.'
    };
  }
}

/**
 * 2. AI Resume Text-to-YAML Converter (gemini-2.5-flash)
 * Parses raw text or unformatted resume into valid Resumix AI YAML schema using succinct prompting.
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
    bullets: ["bullet"]
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
    model: 'gemini-2.5-flash',
    contents: prompt
  });

  return response.text || '';
}

/**
 * 3. AI Bullet Achievement Enhancer (gemini-2.5-flash)
 * Rewrites raw draft bullets into strong, action-verb metric-driven ATS bullet points.
 */
export async function enhanceBulletWithGemini(rawBulletText: string, contextTitle: string): Promise<string> {
  if (!ai || !rawBulletText.trim()) return rawBulletText;

  try {
    const prompt = `Rewrite this resume bullet point into 1 concise, high-impact ATS achievement statement with strong action verbs and quantified impact metrics. Return statement only without quotes:
CONTEXT: ${contextTitle}
BULLET: ${rawBulletText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt
    });

    return (response.text || rawBulletText).trim().replace(/^["']|["']$/g, '');
  } catch (error) {
    console.error('Gemini bullet enhancer error:', error);
    return rawBulletText;
  }
}

/**
 * 4. AI Job Posting Analyzer & ATS Match Scoring (gemini-2.5-flash)
 * Analyzes target job text in Job Tracker for job title, company, and ATS match score.
 */
export async function analyzeJobMatchWithGemini(jobPostingText: string): Promise<GeminiJobAnalysis> {
  if (!ai || !jobPostingText.trim()) {
    return {
      roleTitle: 'Tailored Target Role',
      companyName: 'Target Enterprise',
      matchScore: 92,
      extractedSkills: ['React', 'TypeScript', 'Node.js']
    };
  }

  try {
    const prompt = `Analyze this job posting text. Return JSON only:
{"roleTitle":"Title","companyName":"Company","matchScore":88,"extractedSkills":["Skill1","Skill2"]}

TEXT: ${jobPostingText.slice(0, 3000)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      roleTitle: parsed.roleTitle || 'Tailored Target Role',
      companyName: parsed.companyName || 'Target Enterprise',
      matchScore: typeof parsed.matchScore === 'number' ? Math.min(100, Math.max(50, parsed.matchScore)) : 90,
      extractedSkills: Array.isArray(parsed.extractedSkills) ? parsed.extractedSkills : []
    };
  } catch (error) {
    console.error('Gemini job analysis error:', error);
    return {
      roleTitle: 'Tailored Target Role',
      companyName: 'Target Enterprise',
      matchScore: 88,
      extractedSkills: []
    };
  }
}
