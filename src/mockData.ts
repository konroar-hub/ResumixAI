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
    id: 'style-ai-1786376579614',
    name: 'Monochrome Clarity & Precision',
    description: 'A pure black-and-white minimalist architecture featuring generous whitespace, crisp Inter typography, and refined single-column hierarchy designed for maximum readability.',
    isAiGenerated: true,
    theme: {
      primaryColor: '#000000',
      secondaryColor: '#52525b',
      textColor: '#18181b',
      bgColor: '#ffffff',
      accentColor: '#18181b',
      cardBgColor: '#f4f4f5',
      sidebarBgColor: '#ffffff',
      headerTextColor: '#000000',
      stripeColor: '#000000',
      dividerColor: '#e4e4e7',
      fontFamily: 'inter',
      layout: 'single-column',
      headerAlignment: 'left',
      headerStyle: 'minimal',
      borderStyle: 'solid',
      sectionHeaderStyle: 'uppercase-accent',
      skillsDisplayStyle: 'comma-separated'
    }
  }
];
