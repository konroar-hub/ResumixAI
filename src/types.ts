export type CardCategory = 'experience' | 'project' | 'education' | 'about' | 'skills';

export interface BulletItem {
  id?: string;
  text: string;
}

export interface ExperienceItem {
  id: string;
  category?: CardCategory; // defaults to 'experience' if missing
  title: string;
  company: string; // company, institution, or project organization
  period: string;
  location: string;
  skills: string[];
  bullets: (string | BulletItem)[];
  selected?: boolean;
  isAiTailored?: boolean;
  tailoredForRole?: string;
  isDeviatedFromMaster?: boolean;
}

export interface ResumeItem {
  id: string;
  title: string;
  targetRole: string;
  company?: string;
  updatedAt: string;
  selectedExpIds: string[];
  selectedSkills?: string[];
  customExperiences?: ExperienceItem[];
}

export interface MasterProfile {
  name: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  summary: string;
  experiences: ExperienceItem[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant' | 'system';
  text: string;
  timestamp: string;
  attachedFile?: string;
}

export interface AtsAnalysisDetails {
  fitSummary: string;
  matchedKeywords: string[];
  missingKeywords: string[];
  strengths?: string[];
  gaps?: string[];
}

export interface JobRecord {
  id: string;
  company: string;
  title: string;
  dateAdded: string;
  status: 'Draft' | 'Applied' | 'Interviewing' | 'Offer' | 'Rejected';
  matchScore?: number;
  description?: string;
  resumeId?: string;
  resumeTitle?: string;
  atsAnalysisDetails?: AtsAnalysisDetails;
}

export interface ResumeStyleTheme {
  primaryColor: string;
  secondaryColor: string;
  textColor: string;
  bgColor: string;
  headerBgColor?: string;
  headerTextColor?: string;
  accentColor: string;
  fontFamily: 'inter' | 'roboto' | 'serif' | 'mono' | 'outfit' | 'playfair' | 'space-grotesk';
  layout: 'single-column' | 'sidebar-left' | 'sidebar-right' | 'header-banner' | 'cards-modern' | 'brand-margin-stripe';
  borderStyle: 'solid' | 'dashed' | 'none' | 'double';
  dividerColor: string;
  sectionHeaderStyle: 'clean-underline' | 'filled-badge' | 'uppercase-accent' | 'minimal-left-border' | 'pill-badge' | 'gradient-bar';
  cardBgColor?: string;
  sidebarBgColor?: string;
  stripeColor?: string;
}

export interface ResumeStyle {
  id: string;
  name: string;
  description: string;
  isAiGenerated?: boolean;
  theme: ResumeStyleTheme;
}


