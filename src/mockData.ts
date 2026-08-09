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
    id: 'style-sidebar-left',
    name: 'Left Sidebar Tech',
    description: 'Distinctive dark left sidebar column for Skills & About Me',
    theme: {
      primaryColor: '#0d9488',
      secondaryColor: '#14b8a6',
      textColor: '#1e293b',
      bgColor: '#ffffff',
      sidebarBgColor: '#0f172a',
      headerTextColor: '#ffffff',
      accentColor: '#2dd4bf',
      fontFamily: 'space-grotesk',
      layout: 'sidebar-left',
      borderStyle: 'solid',
      dividerColor: '#e2e8f0',
      sectionHeaderStyle: 'uppercase-accent'
    }
  },
  {
    id: 'style-sidebar-right',
    name: 'Right Column Metrics',
    description: 'Right sidebar layout placing Technical Skills and About on the right',
    theme: {
      primaryColor: '#0369a1',
      secondaryColor: '#0284c7',
      textColor: '#0f172a',
      bgColor: '#f8fafc',
      sidebarBgColor: '#f1f5f9',
      accentColor: '#38bdf8',
      fontFamily: 'outfit',
      layout: 'sidebar-right',
      borderStyle: 'solid',
      dividerColor: '#cbd5e1',
      sectionHeaderStyle: 'filled-badge'
    }
  },
  {
    id: 'style-header-banner',
    name: 'Modern Header Hero',
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
    id: 'style-cards-modern',
    name: 'Cards & Grid Blocks',
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
    id: 'style-swiss-stripe',
    name: 'Swiss Brand Stripe',
    description: 'Thick left margin brand stripe with clean editorial typography',
    theme: {
      primaryColor: '#b91c1c',
      secondaryColor: '#dc2626',
      textColor: '#171717',
      bgColor: '#ffffff',
      stripeColor: '#b91c1c',
      accentColor: '#ef4444',
      fontFamily: 'playfair',
      layout: 'brand-margin-stripe',
      borderStyle: 'solid',
      dividerColor: '#fee2e2',
      sectionHeaderStyle: 'gradient-bar'
    }
  }
];
