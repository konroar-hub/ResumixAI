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
}

export interface ResumeItem {
  id: string;
  title: string;
  targetRole: string;
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

export interface JobRecord {
  id: string;
  company: string;
  title: string;
  dateAdded: string;
  status: 'Draft' | 'Applied' | 'Interviewing' | 'Offer' | 'Rejected';
  matchScore: number;
  resumeId?: string;
  resumeTitle?: string;
}


