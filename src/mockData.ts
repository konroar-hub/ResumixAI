import { JobRecord, ResumeItem, ResumeStyle } from './types';

export const INITIAL_MASTER_YAML = `name: ""
title: ""
email: ""
phone: ""
location: ""
summary: ""

experiences: []
`;

export const DEFAULT_JOB_TRACKER: JobRecord[] = [];

export const INITIAL_RESUMES: ResumeItem[] = [];

export const DEFAULT_RESUME_STYLES: ResumeStyle[] = [
  {
    id: 'style-executive',
    name: 'Executive Indigo',
    description: 'Clean single column with deep indigo headers and high readability',
    theme: {
      primaryColor: '#3730a3',
      secondaryColor: '#4f46e5',
      textColor: '#0f172a',
      bgColor: '#ffffff',
      accentColor: '#6366f1',
      fontFamily: 'inter',
      layout: 'single-column',
      borderStyle: 'solid',
      dividerColor: '#cbd5e1',
      sectionHeaderStyle: 'clean-underline'
    }
  },
  {
    id: 'style-tech-teal',
    name: 'Tech Minimalist',
    description: 'Modern slate and vibrant teal accents suited for engineering & product roles',
    theme: {
      primaryColor: '#0f766e',
      secondaryColor: '#0d9488',
      textColor: '#1e293b',
      bgColor: '#ffffff',
      accentColor: '#14b8a6',
      fontFamily: 'outfit',
      layout: 'single-column',
      borderStyle: 'solid',
      dividerColor: '#ccfbf1',
      sectionHeaderStyle: 'uppercase-accent'
    }
  },
  {
    id: 'style-classic-serif',
    name: 'Classic Harvard',
    description: 'Traditional serif typography with subtle charcoal dividers for finance & legal',
    theme: {
      primaryColor: '#881337',
      secondaryColor: '#9f1239',
      textColor: '#1c1917',
      bgColor: '#ffffff',
      accentColor: '#be123c',
      fontFamily: 'serif',
      layout: 'single-column',
      borderStyle: 'solid',
      dividerColor: '#e7e5e4',
      sectionHeaderStyle: 'minimal-left-border'
    }
  },
  {
    id: 'style-dark-cyber',
    name: 'Cyber Dark Mode',
    description: 'Sleek dark theme with purple glow & neon accents for AI & creative portfolios',
    theme: {
      primaryColor: '#a855f7',
      secondaryColor: '#06b6d4',
      textColor: '#f8fafc',
      bgColor: '#090d16',
      headerBgColor: '#111827',
      accentColor: '#c084fc',
      fontFamily: 'mono',
      layout: 'single-column',
      borderStyle: 'solid',
      dividerColor: '#334155',
      sectionHeaderStyle: 'filled-badge'
    }
  }
];
