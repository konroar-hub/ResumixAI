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
    id: 'style-header-banner',
    name: 'Modern Header Banner',
    description: 'Full-width rich header banner with contrasting typography & pill badges',
    theme: {
      primaryColor: '#0369a1',
      secondaryColor: '#0284c7',
      textColor: '#0f172a',
      bgColor: '#ffffff',
      headerBgColor: '#0f172a',
      headerTextColor: '#ffffff',
      accentColor: '#38bdf8',
      fontFamily: 'outfit',
      layout: 'header-banner',
      borderStyle: 'solid',
      dividerColor: '#e2e8f0',
      sectionHeaderStyle: 'pill-badge'
    }
  },
  {
    id: 'style-sidebar',
    name: 'Split Two-Column Sidebar',
    description: 'Dual column layout with dedicated left sidebar for contact & skills',
    theme: {
      primaryColor: '#0d9488',
      secondaryColor: '#14b8a6',
      textColor: '#1e293b',
      bgColor: '#ffffff',
      sidebarBgColor: '#f0fdf4',
      accentColor: '#0f766e',
      fontFamily: 'space-grotesk',
      layout: 'two-column-sidebar',
      borderStyle: 'solid',
      dividerColor: '#bbf7d0',
      sectionHeaderStyle: 'uppercase-accent'
    }
  },
  {
    id: 'style-cards-modern',
    name: 'Cards & Floating Blocks',
    description: 'Contemporary card blocks with subtle tinting and minimal left borders',
    theme: {
      primaryColor: '#6d28d9',
      secondaryColor: '#7c3aed',
      textColor: '#1e1b4b',
      bgColor: '#faf5ff',
      cardBgColor: '#ffffff',
      accentColor: '#8b5cf6',
      fontFamily: 'inter',
      layout: 'cards-modern',
      borderStyle: 'solid',
      dividerColor: '#ddd6fe',
      sectionHeaderStyle: 'minimal-left-border'
    }
  },
  {
    id: 'style-dark-cyber',
    name: 'Cyber Dark Mode',
    description: 'Sleek dark theme with purple glow & neon accents for AI & tech portfolios',
    theme: {
      primaryColor: '#a855f7',
      secondaryColor: '#06b6d4',
      textColor: '#f8fafc',
      bgColor: '#090d16',
      headerBgColor: '#111827',
      headerTextColor: '#f8fafc',
      accentColor: '#c084fc',
      fontFamily: 'mono',
      layout: 'header-banner',
      borderStyle: 'solid',
      dividerColor: '#334155',
      sectionHeaderStyle: 'filled-badge'
    }
  }
];
