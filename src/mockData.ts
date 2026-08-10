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
      headerAlignment: 'center',
      headerStyle: 'minimal',
      borderStyle: 'solid',
      dividerColor: '#cbd5e1',
      sectionHeaderStyle: 'clean-underline',
      skillsDisplayStyle: 'comma-separated'
    }
  },
  {
    id: 'style-split-header',
    name: 'Split Header Justified Right',
    description: 'Name & Title justified Left with Contact Details justified Right on header bar',
    theme: {
      primaryColor: '#0f766e',
      secondaryColor: '#0d9488',
      textColor: '#1e293b',
      bgColor: '#ffffff',
      headerBgColor: '#f0fdf4',
      headerAlignment: 'split-right',
      headerStyle: 'top-bottom-border',
      accentColor: '#14b8a6',
      fontFamily: 'outfit',
      layout: 'single-column',
      borderStyle: 'solid',
      dividerColor: '#99f6e4',
      sectionHeaderStyle: 'uppercase-accent',
      skillsDisplayStyle: 'pill-badges'
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
      headerAlignment: 'left',
      headerStyle: 'banner-filled',
      accentColor: '#2dd4bf',
      fontFamily: 'space-grotesk',
      layout: 'sidebar-left',
      borderStyle: 'solid',
      dividerColor: '#e2e8f0',
      sectionHeaderStyle: 'uppercase-accent',
      skillsDisplayStyle: 'pill-badges'
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
      headerAlignment: 'left',
      accentColor: '#38bdf8',
      fontFamily: 'outfit',
      layout: 'sidebar-right',
      borderStyle: 'solid',
      dividerColor: '#cbd5e1',
      sectionHeaderStyle: 'filled-badge',
      skillsDisplayStyle: 'bulleted-grid'
    }
  },
  {
    id: 'style-header-banner',
    name: 'Coral Hero Banner',
    description: 'Full-width rich coral header hero banner with white text',
    theme: {
      primaryColor: '#e25b4c',
      secondaryColor: '#f87171',
      textColor: '#1f2937',
      bgColor: '#ffffff',
      headerBgColor: '#e25b4c',
      headerTextColor: '#ffffff',
      headerAlignment: 'center',
      headerStyle: 'banner-filled',
      accentColor: '#ef4444',
      fontFamily: 'outfit',
      layout: 'header-banner',
      borderStyle: 'solid',
      dividerColor: '#fee2e2',
      sectionHeaderStyle: 'pill-badge',
      skillsDisplayStyle: 'comma-separated'
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
      headerAlignment: 'left',
      accentColor: '#8b5cf6',
      fontFamily: 'inter',
      layout: 'cards-modern',
      borderStyle: 'solid',
      dividerColor: '#ddd6fe',
      sectionHeaderStyle: 'minimal-left-border',
      skillsDisplayStyle: 'pill-badges'
    }
  },
  {
    id: 'style-swiss-stripe',
    name: 'Swiss Brand Margin',
    description: 'Thick left margin brand stripe with clean editorial typography',
    theme: {
      primaryColor: '#b91c1c',
      secondaryColor: '#dc2626',
      textColor: '#171717',
      bgColor: '#ffffff',
      stripeColor: '#b91c1c',
      headerAlignment: 'left',
      accentColor: '#ef4444',
      fontFamily: 'playfair',
      layout: 'brand-margin-stripe',
      borderStyle: 'solid',
      dividerColor: '#fee2e2',
      sectionHeaderStyle: 'gradient-bar',
      skillsDisplayStyle: 'comma-separated'
    }
  }
];
