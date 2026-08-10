import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_MASTER_YAML, INITIAL_RESUMES, DEFAULT_JOB_TRACKER, DEFAULT_RESUME_STYLES } from './mockData';
import { MasterProfile, ExperienceItem, ResumeItem, CardCategory, JobRecord, AtsAnalysisDetails, ResumeStyle } from './types';
import yaml from 'js-yaml';
import { toPng, toCanvas } from 'html-to-image';
import { jsPDF } from 'jspdf';
import { 
  Layers, 
  Sparkles, 
  CheckCircle2, 
  Cpu, 
  Plus, 
  FolderKanban, 
  Edit3, 
  Trash2, 
  Eye,
  Briefcase,
  Wand2,
  ChevronRight,
  ChevronLeft,
  Wrench,
  Code2,
  Search,
  Tag,
  Clipboard,
  Copy,
  FileText,
  Download,
  Printer,
  Menu,
  X,
  Home,
  Globe,
  User as UserIcon,
  LogOut,
  Zap,
  GitFork,
  Palette,
  Upload
} from 'lucide-react';
import { SplashPage } from './components/SplashPage';
import {
  tailorResumeWithGemini,
  convertResumeTextToYamlWithGemini,
  convertPdfToYamlWithGemini,
  enhanceBulletWithGemini,
  analyzeJobMatchWithGemini,
  generateResumeStyleWithGemini,
  refineResumeStyleWithGemini,
  cleanYamlCodeBlock
} from './services/geminiService';
import {
  auth,
  onAuthStateChanged,
  User,
  signOut,
  isFirebaseConfigured,
  saveUserDataToFirestore,
  loadUserDataFromFirestore
} from './firebase';

const formatBulletText = (b: any): string => {
  if (!b) return '';
  if (typeof b === 'string') return b;
  if (typeof b === 'object' && b !== null) {
    if ('text' in b && typeof b.text === 'string') return b.text;
    if ('bullet' in b && typeof b.bullet === 'string') return b.bullet;
    return Object.values(b).filter(v => typeof v === 'string').join(', ');
  }
  return String(b);
};

export const RESUME_TO_YAML_PROMPT = `Please convert the following resume into a structured YAML format matching this EXACT schema:

name: "Full Name"
title: "Current or Target Professional Title"
email: "email@example.com"
phone: "+1 (555) 123-4567"
location: "City, State"
summary: "Professional summary paragraph..."

experiences:
  - id: "about-1"
    category: "about"
    title: "Personal Elevator Pitch / Bio"
    bullets:
      - "Passionate Senior Full Stack & AI Engineer specializing in developer tools, streaming LLM inference engines, and responsive web applications."

  - id: "exp-1"
    category: "experience" # Options: experience, project, education, about, skills
    title: "Job Title or Role"
    company: "Company Name"
    period: "2022 - Present"
    location: "City, State"
    skills:
      - "React"
      - "TypeScript"
      - "Node.js"
    bullets:
      - "Achievement bullet point 1..."
      - "Achievement bullet point 2..."

  - id: "exp-2"
    category: "education"
    title: "Degree / Certification"
    company: "University Name"
    period: "2018 - 2022"
    location: "City, State"
    skills:
      - "Coursework"
    bullets:
      - "Graduated with Honors..."

Instructions:
1. Extract all work experience, personal projects, education, bio/about entries, and skills.
2. Category "about" entries ONLY require "id", "category: about", "title", and "bullets" (do NOT include company, period, location, or skills).
3. Output ONLY the raw valid YAML block inside a markdown code block without extra conversational filler.
4. Ensure every entry under experiences has a unique id (e.g. about-1, exp-1, exp-2, ed-1, proj-1).

Here is the resume to convert:
[PASTE YOUR RESUME TEXT HERE]`;

export default function App() {
  const [viewMode, setViewMode] = useState<'splash' | 'app'>(() => {
    try {
      const saved = localStorage.getItem('rt_view_mode');
      if (saved === 'app') return 'app';
    } catch (e) {}
    return 'splash';
  });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'resumes' | 'skills' | 'feed' | 'jobs'>('resumes');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('rt_view_mode', viewMode);
    } catch (e) {}
  }, [viewMode]);

  // Observe Firebase Auth State with persistent session restore
  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
        setIsAuthLoading(false);
        if (user) {
          setViewMode('app');
          try {
            localStorage.setItem('rt_view_mode', 'app');
          } catch (e) {}
        }
      });
      return () => unsubscribe();
    } else {
      setIsAuthLoading(false);
    }
  }, []);

  const handleSignOut = () => {
    if (isFirebaseConfigured) {
      signOut(auth).catch(e => console.error('Signout error:', e));
    }
    setCurrentUser(null);
    setViewMode('splash');
    // Purge memory state completely on sign out so no user data persists
    setParsedProfile({ name: '', title: '', email: '', phone: '', location: '', summary: '', experiences: [] });
    setResumes([]);
    setJobsList(DEFAULT_JOB_TRACKER);
    setResumeStyles(DEFAULT_RESUME_STYLES);
    setActiveResumeId('');
    setActiveStyleId('style-executive');
  };

  // Dual-Persisted Initial States (LocalStorage Instant Restore + Firestore Sync)
  const [parsedProfile, setParsedProfile] = useState<MasterProfile>(() => {
    try {
      const saved = localStorage.getItem('rt_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return { name: '', title: '', email: '', phone: '', location: '', summary: '', experiences: [] };
  });

  const [resumes, setResumes] = useState<ResumeItem[]>(() => {
    try {
      const saved = localStorage.getItem('rt_resumes');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return [];
  });

  const [activeResumeId, setActiveResumeId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('rt_active_resume_id');
      if (saved) return saved;
    } catch (e) {}
    return '';
  });

  const [jobsList, setJobsList] = useState<JobRecord[]>(() => {
    try {
      const saved = localStorage.getItem('rt_jobs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_JOB_TRACKER;
  });

  const [resumeStyles, setResumeStyles] = useState<ResumeStyle[]>(() => {
    try {
      const saved = localStorage.getItem('rt_styles');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_RESUME_STYLES;
  });

  const [activeStyleId, setActiveStyleId] = useState<string>(() => {
    try {
      const saved = localStorage.getItem('rt_active_style_id');
      if (saved) return saved;
    } catch (e) {}
    return 'style-executive';
  });

  const [isAiStyleModalOpen, setIsAiStyleModalOpen] = useState(false);
  const [aiStylePromptInput, setAiStylePromptInput] = useState('');
  const [isGeneratingAiStyle, setIsGeneratingAiStyle] = useState(false);
  const [previewAiStyle, setPreviewAiStyle] = useState<ResumeStyle | null>(null);
  const [editingStyle, setEditingStyle] = useState<ResumeStyle | null>(null);

  const openCreateResumeStyleModal = () => {
    setEditingStyle(null);
    setAiStylePromptInput('');
    setPreviewAiStyle(null);
    setIsAiStyleModalOpen(true);
  };

  const openEditResumeStyleModal = (style: ResumeStyle) => {
    setEditingStyle(style);
    setAiStylePromptInput('');
    setPreviewAiStyle(style);
    setIsAiStyleModalOpen(true);
  };

  const activeStyle = useMemo(() => {
    return resumeStyles.find(s => s.id === activeStyleId) || resumeStyles[0] || DEFAULT_RESUME_STYLES[0];
  }, [resumeStyles, activeStyleId]);

  const deleteResumeStyle = (styleId: string) => {
    if (resumeStyles.length <= 1) return;
    const updatedStyles = resumeStyles.filter(s => s.id !== styleId);
    setResumeStyles(updatedStyles);

    const nextActiveId = activeStyleId === styleId ? (updatedStyles[0]?.id || 'style-executive') : activeStyleId;
    setActiveStyleId(nextActiveId);

    // Synchronously update LocalStorage so deleted styles are never resurrected on page reload
    try {
      localStorage.setItem('rt_styles', JSON.stringify(updatedStyles));
      localStorage.setItem('rt_active_style_id', nextActiveId);
    } catch (e) {}

    // Synchronously update Firestore Cloud
    if (currentUser?.uid) {
      saveUserDataToFirestore(currentUser.uid, {
        resumeStyles: updatedStyles,
        activeStyleId: nextActiveId
      });
    }
  };

  const [isCloudDataLoaded, setIsCloudDataLoaded] = useState(false);
  const [isCloudSaving, setIsCloudSaving] = useState(false);

  // Load data from Firestore when user logs in, enforcing strict account isolation
  useEffect(() => {
    if (currentUser?.uid) {
      setIsCloudDataLoaded(false);
      loadUserDataFromFirestore(currentUser.uid).then(cloudData => {
        let currentStyles = DEFAULT_RESUME_STYLES;
        try {
          const saved = localStorage.getItem('rt_styles');
          if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) currentStyles = parsed;
          }
        } catch (e) {}

        let currentActiveStyleId = 'style-executive';
        try {
          const saved = localStorage.getItem('rt_active_style_id');
          if (saved) currentActiveStyleId = saved;
        } catch (e) {}

        if (cloudData) {
          if (cloudData.profile && Array.isArray(cloudData.profile.experiences)) {
            setParsedProfile(cloudData.profile);
          } else {
            setParsedProfile({ name: '', title: '', email: '', phone: '', location: '', summary: '', experiences: [] });
          }
          if (cloudData.resumes && Array.isArray(cloudData.resumes)) {
            setResumes(cloudData.resumes);
            if (cloudData.resumes.length > 0) setActiveResumeId(cloudData.resumes[0].id);
          } else {
            setResumes([]);
            setActiveResumeId('');
          }
          if (cloudData.jobsList && Array.isArray(cloudData.jobsList)) {
            setJobsList(cloudData.jobsList);
          } else {
            setJobsList([]);
          }

          // Smart Style Merge: Preserves local custom created AI styles AND syncs cloud styles
          const styleMap = new Map<string, ResumeStyle>();
          DEFAULT_RESUME_STYLES.forEach(s => styleMap.set(s.id, s));
          if (cloudData.resumeStyles && Array.isArray(cloudData.resumeStyles)) {
            cloudData.resumeStyles.forEach(s => styleMap.set(s.id, s));
          }
          currentStyles.forEach(s => styleMap.set(s.id, s)); // Local custom styles preserved 100%

          const mergedStyles = Array.from(styleMap.values());
          setResumeStyles(mergedStyles);
          try {
            localStorage.setItem('rt_styles', JSON.stringify(mergedStyles));
          } catch (e) {}

          const targetActiveId = cloudData.activeStyleId && mergedStyles.some(s => s.id === cloudData.activeStyleId)
            ? cloudData.activeStyleId
            : (mergedStyles.some(s => s.id === currentActiveStyleId) ? currentActiveStyleId : mergedStyles[0].id);

          setActiveStyleId(targetActiveId);
          try {
            localStorage.setItem('rt_active_style_id', targetActiveId);
          } catch (e) {}

          // Ensure Firestore is updated with the complete merged styles set
          if (currentUser?.uid) {
            saveUserDataToFirestore(currentUser.uid, {
              resumeStyles: mergedStyles,
              activeStyleId: targetActiveId
            });
          }
        } else {
          // Brand New Firestore User -> Initialize 100% Clean Blank Profile & 0 Resumes
          setParsedProfile({ name: '', title: '', email: '', phone: '', location: '', summary: '', experiences: [] });
          setResumes([]);
          setJobsList([]);
          setActiveResumeId('');
        }
        setIsCloudDataLoaded(true);
      }).catch(err => {
        console.error('Firestore load error:', err);
        setIsCloudDataLoaded(true);
      });
    } else {
      setIsCloudDataLoaded(false);
      setParsedProfile({ name: '', title: '', email: '', phone: '', location: '', summary: '', experiences: [] });
      setResumes([]);
      setJobsList([]);
      setActiveResumeId('');
    }
  }, [currentUser?.uid]);

  // Dual-Persistence Auto-Sync (LocalStorage + Firestore)
  useEffect(() => {
    try {
      localStorage.setItem('rt_profile', JSON.stringify(parsedProfile));
    } catch (e) {}
    if (currentUser?.uid && isCloudDataLoaded) {
      saveUserDataToFirestore(currentUser.uid, { profile: parsedProfile });
    }
  }, [parsedProfile, currentUser?.uid, isCloudDataLoaded]);

  useEffect(() => {
    try {
      localStorage.setItem('rt_resumes', JSON.stringify(resumes));
      if (activeResumeId) localStorage.setItem('rt_active_resume_id', activeResumeId);
    } catch (e) {}
    if (currentUser?.uid && isCloudDataLoaded) {
      saveUserDataToFirestore(currentUser.uid, { resumes, activeStyleId });
    }
  }, [resumes, activeResumeId, currentUser?.uid, isCloudDataLoaded]);

  useEffect(() => {
    try {
      localStorage.setItem('rt_jobs', JSON.stringify(jobsList));
    } catch (e) {}
    if (currentUser?.uid && isCloudDataLoaded) {
      saveUserDataToFirestore(currentUser.uid, { jobsList });
    }
  }, [jobsList, currentUser?.uid, isCloudDataLoaded]);

  useEffect(() => {
    try {
      localStorage.setItem('rt_styles', JSON.stringify(resumeStyles));
    } catch (e) {}
    if (currentUser?.uid && isCloudDataLoaded) {
      saveUserDataToFirestore(currentUser.uid, { resumeStyles });
    }
  }, [resumeStyles, currentUser?.uid, isCloudDataLoaded]);

  useEffect(() => {
    try {
      localStorage.setItem('rt_active_style_id', activeStyleId);
    } catch (e) {}
    if (currentUser?.uid && isCloudDataLoaded) {
      saveUserDataToFirestore(currentUser.uid, { activeStyleId });
    }
  }, [activeStyleId, currentUser?.uid, isCloudDataLoaded]);

  const forceSyncToCloud = async () => {
    if (!currentUser?.uid || !isFirebaseConfigured) return;
    setIsCloudSaving(true);
    try {
      await saveUserDataToFirestore(currentUser.uid, {
        profile: parsedProfile,
        resumes,
        jobsList,
        resumeStyles
      });
    } catch (e) {
      console.error('Manual Cloud Sync error:', e);
    } finally {
      setIsCloudSaving(false);
    }
  };

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const getElementOffsetTop = (el: HTMLElement, parent: HTMLElement): number => {
    const elRect = el.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return elRect.top - parentRect.top;
  };

  const cropCanvas = (sourceCanvas: HTMLCanvasElement, cropY: number, cropHeight: number): string => {
    const destCanvas = document.createElement('canvas');
    destCanvas.width = sourceCanvas.width;
    destCanvas.height = Math.max(1, Math.floor(cropHeight));
    const ctx = destCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        sourceCanvas,
        0, Math.floor(cropY), sourceCanvas.width, Math.floor(cropHeight),
        0, 0, sourceCanvas.width, Math.floor(cropHeight)
      );
    }
    return destCanvas.toDataURL('image/png');
  };

  const embedSelectableTextLayer = (pdf: jsPDF, rootEl: HTMLElement, elementWidth: number, pageOffsetPx: number = 0, targetPageNum: number = 1) => {
    try {
      pdf.setPage(targetPageNum);
      const parentRect = rootEl.getBoundingClientRect();
      const page1HeightPx = Math.floor((elementWidth * 11) / 8.5);

      const itemsToEmbed: { text: string; xInches: number; yInches: number; fontSizePt: number; domIndex: number }[] = [];

      const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
      let node: Node | null;
      let domCounter = 0;

      while ((node = walker.nextNode())) {
        domCounter++;
        const parentEl = node.parentElement;
        if (!parentEl) continue;

        const text = node.nodeValue ? node.nodeValue.trim() : '';
        if (!text) continue;

        if (parentEl.closest('.no-print') || parentEl.tagName === 'SVG' || parentEl.tagName === 'BUTTON') continue;

        const range = document.createRange();
        range.selectNodeContents(node);
        const rects = range.getClientRects();

        if (rects.length > 0) {
          const textRect = rects[0];
          const relTopPx = textRect.top - parentRect.top;
          const relLeftPx = textRect.left - parentRect.left;

          if (relTopPx >= pageOffsetPx - 10 && relTopPx < (pageOffsetPx + page1HeightPx)) {
            const computedStyle = window.getComputedStyle(parentEl);
            const fontSizePx = parseFloat(computedStyle.fontSize) || 12;
            const fontSizePt = Math.max(7, Math.min(18, fontSizePx * 0.75));

            const xInches = Math.max(0.25, (relLeftPx * 8.5) / elementWidth);
            const yInches = Math.max(0.35, (((relTopPx - pageOffsetPx) * 11) / page1HeightPx) + (fontSizePt / 72));

            itemsToEmbed.push({ text, xInches, yInches, fontSizePt, domIndex: domCounter });
          }
        }
      }

      // Stable Quantized Line-Band Sorting: Group by discrete 0.15in line bands, then preserve DOM reading order
      itemsToEmbed.sort((a, b) => {
        const lineA = Math.floor(a.yInches / 0.15);
        const lineB = Math.floor(b.yInches / 0.15);

        if (lineA !== lineB) {
          return lineA - lineB; // Strict top-to-bottom line band order
        }
        return a.domIndex - b.domIndex; // Preserve DOM reading order within the same line band
      });

      // Set PDF Text Rendering Mode 3 (Invisible Text) and write elements sequentially in exact reading order
      (pdf as any).internal.write('3 Tr');
      for (const item of itemsToEmbed) {
        try {
          pdf.setFontSize(item.fontSizePt);
          pdf.text(item.text, item.xInches, item.yInches);
        } catch (err) {}
      }
      (pdf as any).internal.write('0 Tr');
    } catch (e) {
      console.error('Error embedding selectable text layer in PDF:', e);
    }
  };

  const handleDownloadPdf = async (resumeToDownload?: ResumeItem) => {
    const targetResume = resumeToDownload || activeResume;
    if (!targetResume) return;

    if (resumeToDownload && resumeToDownload.id !== activeResumeId) {
      setActiveResumeId(resumeToDownload.id);
    }

    setIsGeneratingPdf(true);

    try {
      await new Promise(r => setTimeout(r, 150));

      const element = document.getElementById('resume-document-pdf-area');
      if (!element) {
        window.print();
        return;
      }

      const candidateName = parsedProfile.name
        ? parsedProfile.name.trim().replace(/[^a-zA-Z0-9]/g, '_')
        : 'Candidate';
      const resumeTitle = targetResume.title.trim().replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `${candidateName}_${resumeTitle}.pdf`;

      const pdfBgColor = activeStyle.theme.bgColor || '#ffffff';

      const elementWidth = element.clientWidth || 800;
      const initialHeight = element.clientHeight || 1100;
      const page1HeightPx = Math.floor((elementWidth * 11) / 8.5); // 1 Letter page height in DOM pixels (e.g. 1035px)

      // Smart DOM Spacer Pushing: Identify the element that crosses page1HeightPx and push it cleanly to Page 2
      const insertedSpacers: HTMLElement[] = [];

      if (initialHeight > page1HeightPx + 20) {
        const breakables = element.querySelectorAll('.pdf-card-block, li, p, h2, h3, .pdf-break-target');
        let breakTarget: HTMLElement | null = null;

        breakables.forEach((item) => {
          const htmlEl = item as HTMLElement;
          const itemTop = getElementOffsetTop(htmlEl, element);
          const itemBottom = itemTop + htmlEl.offsetHeight;

          const isHeader = htmlEl.tagName === 'H2' || htmlEl.tagName === 'H3' || htmlEl.classList.contains('pdf-section-header');

          if (isHeader) {
            if (itemTop < page1HeightPx && itemBottom > (page1HeightPx - 60)) {
              if (!breakTarget || getElementOffsetTop(breakTarget, element) > itemTop) {
                breakTarget = htmlEl;
              }
            }
          } else {
            if (itemTop < page1HeightPx && itemBottom > (page1HeightPx - 20)) {
              let target = htmlEl;
              const prev = htmlEl.previousElementSibling as HTMLElement;
              if (prev && (prev.tagName === 'H2' || prev.tagName === 'H3' || prev.classList.contains('pdf-section-header'))) {
                target = prev;
              }
              if (!breakTarget || getElementOffsetTop(breakTarget, element) > getElementOffsetTop(target, element)) {
                breakTarget = target;
              }
            }
          }
        });

        if (breakTarget) {
          const targetTop = getElementOffsetTop(breakTarget, element);
          const pushAmount = Math.max(10, Math.ceil(page1HeightPx - targetTop + 16));

          const spacer = document.createElement('div');
          spacer.className = 'pdf-break-spacer-temp';
          spacer.style.height = `${pushAmount}px`;
          spacer.style.width = '100%';
          spacer.style.pointerEvents = 'none';

          const targetEl = breakTarget as HTMLElement;
          if (targetEl && targetEl.parentNode) {
            targetEl.parentNode.insertBefore(spacer, targetEl);
            insertedSpacers.push(spacer);
          }
        }
      }

      // 1. Render updated DOM to high-DPI HTML Canvas using toCanvas
      const fullCanvas = await toCanvas(element, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: pdfBgColor
      });

      // Remove temporary DOM spacers immediately after canvas capture
      insertedSpacers.forEach(spacer => {
        if (spacer.parentNode) spacer.parentNode.removeChild(spacer);
      });

      const pdf = new jsPDF({ unit: 'in', format: 'letter', orientation: 'portrait' });
      const updatedHeight = element.clientHeight || initialHeight;

      // If document fits on 1 page:
      if (updatedHeight <= page1HeightPx + 20) {
        pdf.setFillColor(pdfBgColor);
        pdf.rect(0, 0, 8.5, 11.0, 'F');
        pdf.addImage(fullCanvas.toDataURL('image/png'), 'PNG', 0, 0, 8.5, (updatedHeight * 8.5) / elementWidth);
        
        // Embed Highlightable Vector Text Layer for ATS Compatibility
        embedSelectableTextLayer(pdf, element, elementWidth, 0, 1);

        pdf.save(filename);
        return;
      }

      // Multi-Page export using exact page height canvas slicing
      const scale = fullCanvas.width / elementWidth;
      const page1CanvasHeight = Math.floor(page1HeightPx * scale);

      const page1Png = cropCanvas(fullCanvas, 0, page1CanvasHeight);
      const remainingCanvasHeight = fullCanvas.height - page1CanvasHeight;
      const page2Png = cropCanvas(fullCanvas, page1CanvasHeight, remainingCanvasHeight);

      // Page 1 (Full 11.0 in height)
      pdf.setFillColor(pdfBgColor);
      pdf.rect(0, 0, 8.5, 11.0, 'F');
      pdf.addImage(page1Png, 'PNG', 0, 0, 8.5, 11.0);
      embedSelectableTextLayer(pdf, element, elementWidth, 0, 1);

      // Page 2 (Full 11.0 in height with 0.4in top margin)
      pdf.addPage('letter', 'portrait');
      pdf.setFillColor(pdfBgColor);
      pdf.rect(0, 0, 8.5, 11.0, 'F');
      const page2NaturalHeightInches = (remainingCanvasHeight * 8.5) / fullCanvas.width;
      pdf.addImage(page2Png, 'PNG', 0, 0.4, 8.5, Math.min(10.6, page2NaturalHeightInches));
      embedSelectableTextLayer(pdf, element, elementWidth, page1HeightPx, 2);

      pdf.save(filename);
    } catch (err) {
      console.error('Client-side PDF generation error:', err);
      window.print();
    } finally {
      setIsGeneratingPdf(false);
    }
  };
  const [jobDescription, setJobDescription] = useState('');
  const [viewingJobDescription, setViewingJobDescription] = useState<JobRecord | null>(null);
  const [viewingAtsAnalysisJob, setViewingAtsAnalysisJob] = useState<JobRecord | null>(null);
  const [analyzingJobId, setAnalyzingJobId] = useState<string | null>(null);

  const runAtsJobMatchAnalysis = async (job: JobRecord) => {
    if (!job.description) {
      alert("No job description text stored for this job entry. Paste job description text to run ATS analysis.");
      return;
    }
    setAnalyzingJobId(job.id);
    try {
      const linkedResume = resumes.find(r => r.id === job.resumeId);
      let candidateContext = '';
      if (linkedResume) {
        candidateContext = `Target Role: ${linkedResume.targetRole}\nSkills: ${linkedResume.selectedSkills?.join(', ')}`;
      } else {
        candidateContext = `Name: ${parsedProfile.name}\nTitle: ${parsedProfile.title}\nExperiences: ${parsedProfile.experiences?.map(e => e.title + ' ' + e.company).join(', ')}`;
      }

      const analysis = await analyzeJobMatchWithGemini(job.description, candidateContext);
      const updatedDetails: AtsAnalysisDetails = {
        fitSummary: analysis.fitSummary,
        matchedKeywords: analysis.matchedKeywords,
        missingKeywords: analysis.missingKeywords,
        strengths: analysis.strengths,
        gaps: analysis.gaps
      };

      setJobsList(prev => prev.map(j => {
        if (j.id !== job.id) return j;
        return {
          ...j,
          title: j.title === 'Tailored Target Role' || j.title === 'Target Role' || !j.title ? analysis.roleTitle : j.title,
          company: j.company === 'Target Enterprise' || j.company === 'Target Company' || !j.company ? analysis.companyName : j.company,
          matchScore: analysis.matchScore,
          atsAnalysisDetails: updatedDetails
        };
      }));
    } catch (e) {
      console.error('ATS Match Analysis Error:', e);
    } finally {
      setAnalyzingJobId(null);
    }
  };

  // 2-Stage Create Resume Variant Wizard State
  const [isCreatingResume, setIsCreatingResume] = useState(false);
  const [createResumeStage, setCreateResumeStage] = useState<1 | 2>(1);
  const [newResumeTitle, setNewResumeTitle] = useState('');
  const [newResumeRole, setNewResumeRole] = useState('');
  const [showStage1Company, setShowStage1Company] = useState(false);
  const [stage1CompanyName, setStage1CompanyName] = useState('');
  const [stage1JobPostingText, setStage1JobPostingText] = useState('');
  const [isLlmGenerating, setIsLlmGenerating] = useState(false);

  // Stage 2 Card Selection Wizard State (Skills is after Education)
  const SECTION_ORDER: CardCategory[] = ['about', 'experience', 'project', 'education', 'skills'];

  function MiniResumeDocumentTile({ 
    style, 
    profileName, 
    profileTitle, 
    className = "w-36 h-48" 
  }: { 
    style: ResumeStyle; 
    profileName?: string; 
    profileTitle?: string; 
    className?: string; 
  }) {
    const theme = style.theme;
    const name = profileName || 'KONSTANTIN VICTORIA';
    const title = profileTitle || 'Machine Learning Engineer';
    const fontFamily = theme.fontFamily === 'serif' || theme.fontFamily === 'playfair' ? 'Georgia, serif' : theme.fontFamily === 'mono' ? 'Courier New, monospace' : theme.fontFamily === 'outfit' || theme.fontFamily === 'space-grotesk' ? 'Outfit, sans-serif' : 'Inter, sans-serif';

    return (
      <div 
        className={`rounded-xl p-2 flex flex-col justify-between border shadow-md relative overflow-hidden transition-all text-left pointer-events-none select-none ${className}`}
        style={{ 
          backgroundColor: theme.bgColor, 
          color: theme.textColor,
          fontFamily,
          borderColor: theme.dividerColor 
        }}
      >
        {/* Brand Margin Stripe */}
        {theme.layout === 'brand-margin-stripe' && (
          <div 
            className="absolute top-0 bottom-0 left-0 w-1.5" 
            style={{ backgroundColor: theme.stripeColor || theme.primaryColor }}
          />
        )}

        <div className={`space-y-1 ${theme.layout === 'brand-margin-stripe' ? 'pl-1.5' : ''}`}>
          {/* Header Section */}
          {theme.headerAlignment === 'split-right' ? (
            <div 
              className={`pb-1 border-b flex justify-between items-start text-[6px] ${theme.headerBgColor ? 'p-1 rounded mb-1' : ''}`}
              style={{ 
                borderColor: theme.dividerColor, 
                backgroundColor: theme.headerBgColor || 'transparent' 
              }}
            >
              <div>
                <div className="font-bold uppercase tracking-tight text-[6.5px]" style={{ color: theme.headerTextColor || theme.primaryColor }}>
                  {name}
                </div>
                <div className="font-semibold text-[5px]" style={{ color: theme.headerTextColor || theme.secondaryColor }}>
                  {title}
                </div>
              </div>
              <div className="text-right text-[4px] opacity-75 leading-tight" style={{ color: theme.headerTextColor || theme.textColor }}>
                <div>konstantin@email.com</div>
                <div>(415) 889-0008</div>
              </div>
            </div>
          ) : (
            <div 
              className={`pb-1 border-b text-[6px] ${
                theme.headerAlignment === 'left' ? 'text-left' :
                theme.headerAlignment === 'right' ? 'text-right' : 'center'
              } ${theme.headerBgColor ? 'p-1 rounded mb-1' : ''}`}
              style={{ 
                borderColor: theme.dividerColor, 
                backgroundColor: theme.headerBgColor || 'transparent' 
              }}
            >
              <div className="font-bold uppercase tracking-tight text-[6.5px]" style={{ color: theme.headerTextColor || theme.primaryColor }}>
                {name}
              </div>
              <div className="font-semibold text-[5px]" style={{ color: theme.headerTextColor || theme.secondaryColor }}>
                {title}
              </div>
              <div className="text-[4px] opacity-75 mt-0.5" style={{ color: theme.headerTextColor || theme.textColor }}>
                konstantin@email.com • (415) 889-0008
              </div>
            </div>
          )}

          {/* Layout Body Renderer */}
            <div className="space-y-1 text-[5px]">
              {/* About */}
              <div>
                <div className="font-bold uppercase border-b text-[5px]" style={{ borderColor: theme.dividerColor, color: theme.primaryColor }}>
                  About Me
                </div>
                <p className="text-[4px] leading-tight opacity-90 mt-0.5">
                  Versatile Software Engineer with background in Applied Math &amp; ML systems automation.
                </p>
              </div>

              {/* Skills */}
              <div>
                <div className="font-bold uppercase border-b text-[5px]" style={{ borderColor: theme.dividerColor, color: theme.primaryColor }}>
                  Skills
                </div>
                {theme.skillsDisplayStyle === 'pill-badges' ? (
                  <div className="flex flex-wrap gap-0.5 mt-0.5">
                    {['Python', 'TypeScript', 'C++', 'AWS', 'Ray'].map(sk => (
                      <span key={sk} className="px-1 py-0.2 rounded-full text-[3.5px] border" style={{ borderColor: theme.dividerColor, backgroundColor: theme.cardBgColor || theme.bgColor }}>
                        {sk}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-[4px] opacity-90 mt-0.5">
                    Python • TypeScript • C++ • AWS • Ray • MySQL
                  </div>
                )}
              </div>

              {/* Experience */}
              <div className="space-y-0.5">
                <div className="font-bold uppercase border-b text-[5px]" style={{ borderColor: theme.dividerColor, color: theme.primaryColor }}>
                  Experience
                </div>
                <div className={`space-y-0.5 ${theme.layout === 'cards-modern' ? 'p-1 rounded border shadow-xs' : ''}`} style={{ backgroundColor: theme.layout === 'cards-modern' ? (theme.cardBgColor || theme.bgColor) : 'transparent', borderColor: theme.dividerColor }}>
                  <div className="flex justify-between items-baseline font-bold text-[5px]">
                    <span>Machine Learning Engineer (Intern)</span>
                    <span className="opacity-70 text-[4px]" style={{ color: theme.secondaryColor }}>Shovels '23</span>
                  </div>
                  <div className="text-[4px] leading-tight opacity-90">
                    • Architected custom API gateway cutting query latency to &lt;2s.
                  </div>
                </div>
              </div>
            </div>
        </div>

        {/* Footer Title Badge */}
        <div 
          className="pt-1 border-t text-[7.5px] font-bold truncate flex items-center justify-between mt-auto"
          style={{ borderColor: theme.dividerColor, color: theme.textColor }}
        >
          <span className="truncate">{style.name}</span>
          <span className="text-[6px] opacity-70 font-mono shrink-0 ml-1">
            {style.isAiGenerated ? '✨ AI' : theme.layout}
          </span>
        </div>
      </div>
    );
  }

  const [wizardCategoryIndex, setWizardCategoryIndex] = useState<number>(0);
  const [wizardSelectedExpIds, setWizardSelectedExpIds] = useState<Set<string>>(new Set());
  const [wizardExtraSkills, setWizardExtraSkills] = useState<Set<string>>(new Set());
  const [customWizardSkillInput, setCustomWizardSkillInput] = useState('');
  // Skills Bank Search & Add State
  const [skillsSearchQuery, setSkillsSearchQuery] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillTargetCardId, setNewSkillTargetCardId] = useState('');

  const [feedCategoryFilter, setFeedCategoryFilter] = useState<CardCategory | 'all'>('all');

  // Card Creation & Editing state
  const [editingCard, setEditingCard] = useState<{
    target: 'master' | 'resume' | 'wizard';
    resumeId?: string;
    card: ExperienceItem;
    isNew?: boolean;
  } | null>(null);

  // Resume editing state
  const [editingResumeId, setEditingResumeId] = useState<string | null>(null);

  const openEditResumeWizard = (resume: ResumeItem) => {
    setEditingResumeId(resume.id);
    setNewResumeTitle(resume.title);
    setNewResumeRole(resume.targetRole);
    setStage1CompanyName(resume.company || '');
    setWizardCustomTailoredCards(resume.customExperiences || []);
    setWizardSelectedExpIds(new Set(resume.selectedExpIds));
    setWizardExtraSkills(new Set(resume.selectedSkills || []));
    setCreateResumeStage(2);
    setWizardCategoryIndex(0);
    setIsCreatingResume(true);
  };

  const [cardFormCategory, setCardFormCategory] = useState<CardCategory>('experience');
  const [cardFormTitle, setCardFormTitle] = useState('');
  const [cardFormCompany, setCardFormCompany] = useState('');
  const [cardFormPeriod, setCardFormPeriod] = useState('');
  const [cardFormLocation, setCardFormLocation] = useState('');
  const [cardFormSkills, setCardFormSkills] = useState('');
  const [cardFormBulletList, setCardFormBulletList] = useState<{ id: string; text: string }[]>([{ id: `b-${Date.now()}-0`, text: '' }]);

  // Paste YAML, PDF Upload & AI Enhancer Loading States
  const [isPasteYamlOpen, setIsPasteYamlOpen] = useState(false);
  const [pasteYamlInput, setPasteYamlInput] = useState('');
  const [pasteYamlError, setPasteYamlError] = useState('');
  const [copiedPromptSuccess, setCopiedPromptSuccess] = useState(false);
  const [enhancingBulletIndex, setEnhancingBulletIndex] = useState<number | null>(null);
  const [bulletCustomPrompts, setBulletCustomPrompts] = useState<{ [bulletId: string]: string }>({});
  const [showPromptInput, setShowPromptInput] = useState<{ [bulletId: string]: boolean }>({});

  const resumePdfFileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePdfFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPasteYamlOpen(true);
    setIsLlmGenerating(true);
    setPasteYamlError('');
    setPasteYamlInput('');

    try {
      if (file.name.endsWith('.pdf') || file.type === 'application/pdf') {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = reader.result as string;
            const yamlResult = await convertPdfToYamlWithGemini(base64Data, 'application/pdf');
            setPasteYamlInput(yamlResult);
          } catch (err: any) {
            setPasteYamlError(err?.message || 'Failed to extract YAML from PDF document.');
          } finally {
            setIsLlmGenerating(false);
          }
        };
        reader.onerror = () => {
          setPasteYamlError('Error reading PDF file.');
          setIsLlmGenerating(false);
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const textContent = reader.result as string;
            if (file.name.endsWith('.yaml') || file.name.endsWith('.yml')) {
              setPasteYamlInput(textContent);
            } else {
              const yamlResult = await convertResumeTextToYamlWithGemini(textContent);
              setPasteYamlInput(yamlResult);
            }
          } catch (err: any) {
            setPasteYamlError(err?.message || 'Failed to convert document text to YAML.');
          } finally {
            setIsLlmGenerating(false);
          }
        };
        reader.onerror = () => {
          setPasteYamlError('Error reading document file.');
          setIsLlmGenerating(false);
        };
        reader.readAsText(file);
      }
    } catch (err: any) {
      setPasteYamlError(err?.message || 'Failed to process uploaded file.');
      setIsLlmGenerating(false);
    } finally {
      if (e.target) e.target.value = '';
    }
  };

  const handleAiEnhanceBullet = async (index: number) => {
    const item = cardFormBulletList[index];
    if (!item || !item.text.trim()) return;
    setEnhancingBulletIndex(index);
    try {
      const customPromptText = bulletCustomPrompts[item.id] || '';
      const enhanced = await enhanceBulletWithGemini(item.text, cardFormTitle || 'Role Experience', customPromptText);
      if (enhanced && enhanced.trim()) {
        const updated = [...cardFormBulletList];
        updated[index] = { ...updated[index], text: enhanced.trim() };
        setCardFormBulletList(updated);
      }
    } catch (e) {
      console.error('AI Bullet Enhance error:', e);
    } finally {
      setEnhancingBulletIndex(null);
    }
  };
  const [wizardCustomTailoredCards, setWizardCustomTailoredCards] = useState<ExperienceItem[]>([]);



  const handleAiConvertTextToYaml = async () => {
    if (!pasteYamlInput.trim()) return;
    setIsLlmGenerating(true);
    setPasteYamlError('');
    try {
      const yamlResult = await convertResumeTextToYamlWithGemini(pasteYamlInput);
      setPasteYamlInput(yamlResult);
    } catch (e: any) {
      setPasteYamlError(e?.message || 'Failed to convert resume text to YAML.');
    } finally {
      setIsLlmGenerating(false);
    }
  };

  const handleAiTailorJobPost = async () => {
    if (!stage1JobPostingText.trim()) return;
    setIsLlmGenerating(true);
    try {
      const res = await tailorResumeWithGemini(parsedProfile, stage1JobPostingText);
      const targetRoleName = stage1CompanyName ? `${stage1CompanyName} Role` : (newResumeRole || 'Target Role');
      const generatedCustomCards: ExperienceItem[] = [];

      // 1. Process Tailored Card Overrides for Experience & Project cards from Gemini AI
      if (res.tailoredCardOverrides && res.tailoredCardOverrides.length > 0) {
        res.tailoredCardOverrides.forEach(override => {
          const origCard = (parsedProfile?.experiences || []).find(e => e.id === override.id);
          if (origCard && override.tailoredBullets && override.tailoredBullets.length > 0) {
            generatedCustomCards.push({
              ...origCard,
              id: `ai-tailored-${origCard.id}-${Date.now()}`,
              bullets: override.tailoredBullets,
              isAiTailored: true,
              tailoredForRole: targetRoleName
            });
          }
        });
      }

      // 2. ALWAYS Auto-generate a job-tailored AI About Me / Summary Card for every new tailored resume
      const aboutParagraph = res.generatedAboutCard?.paragraph?.trim() ||
        `Accomplished specialist targeting ${targetRoleName} opportunities with specialized technical expertise and a proven track record delivering scalable solutions matching enterprise requirements.`;

      generatedCustomCards.push({
        id: `ai-tailored-about-${Date.now()}`,
        category: 'about',
        title: res.generatedAboutCard?.title || 'Professional Bio & Summary',
        company: '',
        period: '',
        location: '',
        skills: [],
        bullets: [aboutParagraph],
        isAiTailored: true,
        tailoredForRole: targetRoleName
      });

      // Store variant-specific AI tailored cards without altering Master Repository
      setWizardCustomTailoredCards(generatedCustomCards);

      const aiCardIds = generatedCustomCards.map(c => c.id);

      // Pre-select education cards by default
      const eduCardIds = (parsedProfile?.experiences || [])
        .filter(e => (e.category || 'experience') === 'education')
        .map(e => e.id);

      setWizardSelectedExpIds(new Set([...aiCardIds, ...eduCardIds]));

      if (res.suggestedSkills.length > 0) {
        setWizardExtraSkills(new Set(res.suggestedSkills));
      }

      if (!newResumeTitle.trim()) {
        setNewResumeTitle(stage1CompanyName ? `${stage1CompanyName} Resume` : 'Tailored Resume Variant');
      }

      setCreateResumeStage(2);
      setWizardCategoryIndex(0);
    } catch (e) {
      console.error('AI Tailor Error:', e);
    } finally {
      setIsLlmGenerating(false);
    }
  };

  const [selectedExpIds, setSelectedExpIds] = useState<Set<string>>(
    new Set(parsedProfile.experiences?.map(e => e.id) || [])
  );

  const activeResume = resumes.find(r => r.id === activeResumeId) || resumes[0];

  // Master Skills Bank derived from attached cards
  const masterSkillsBank = useMemo(() => {
    const bankMap = new Map<string, { cardId: string; cardTitle: string; company: string; category: string }[]>();

    (parsedProfile?.experiences || []).forEach(exp => {
      const cat = exp.category || 'experience';
      (exp.skills || []).forEach(s => {
        const clean = s.trim();
        if (!clean) return;
        if (!bankMap.has(clean)) {
          bankMap.set(clean, []);
        }
        bankMap.get(clean)!.push({
          cardId: exp.id,
          cardTitle: exp.title,
          company: exp.company,
          category: cat
        });
      });
    });

    return Array.from(bankMap.entries()).map(([skillName, attachedCards]) => ({
      skillName,
      attachedCards
    }));
  }, [parsedProfile]);

  // Auto-filled skills derived from cards selected in Wizard steps 1-4 (About, Experience, Projects, Education)
  const autoFilledWizardSkills = useMemo(() => {
    const skillsSet = new Set<string>();
    (parsedProfile?.experiences || []).forEach(exp => {
      if (wizardSelectedExpIds.has(exp.id)) {
        (exp.skills || []).forEach(s => {
          if (s.trim()) skillsSet.add(s.trim());
        });
      }
    });
    return Array.from(skillsSet);
  }, [parsedProfile, wizardSelectedExpIds]);

  const openCardEditor = (
    target: 'master' | 'resume' | 'wizard',
    card?: ExperienceItem,
    resumeId?: string,
    defaultCategory: CardCategory = 'experience'
  ) => {
    if (card) {
      setEditingCard({ target, resumeId, card, isNew: false });
      setCardFormCategory(card.category || 'experience');
      setCardFormTitle(card.title);
      setCardFormCompany(card.company);
      setCardFormPeriod(card.period);
      setCardFormLocation(card.location);
      setCardFormSkills(card.skills?.join(', ') || '');
      const rawBullets = card.bullets || [];
      const parsedBullets = rawBullets.map((b, idx) => {
        if (typeof b === 'object' && b !== null) {
          return { id: b.id || `b-${Date.now()}-${idx}`, text: b.text || String(b) };
        }
        return { id: `b-${Date.now()}-${idx}`, text: String(b) };
      });
      setCardFormBulletList(parsedBullets.length > 0 ? parsedBullets : [{ id: `b-${Date.now()}-0`, text: '' }]);
    } else {
      const newCard: ExperienceItem = {
        id: `card-${Date.now()}`,
        category: defaultCategory,
        title: '',
        company: '',
        period: '2026 - Present',
        location: '',
        skills: [],
        bullets: []
      };
      setEditingCard({ target, resumeId, card: newCard, isNew: true });
      setCardFormCategory(defaultCategory);
      setCardFormTitle('');
      setCardFormCompany('');
      setCardFormPeriod('2026 - Present');
      setCardFormLocation('');
      setCardFormSkills('');
      setCardFormBulletList([{ id: `b-${Date.now()}-0`, text: '' }]);
    }
  };

  const toggleExpSelection = (id: string) => {
    setSelectedExpIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const copyLlmPromptToClipboard = () => {
    navigator.clipboard.writeText(RESUME_TO_YAML_PROMPT);
    setCopiedPromptSuccess(true);
    setTimeout(() => setCopiedPromptSuccess(false), 2500);
  };

  const handleImportYaml = (mode: 'merge' | 'replace') => {
    setPasteYamlError('');
    const rawInput = cleanYamlCodeBlock(pasteYamlInput);
    if (!rawInput.trim()) {
      setPasteYamlError('Please paste valid YAML content.');
      return;
    }

    try {
      const parsed = yaml.load(rawInput) as MasterProfile;
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid YAML format.');
      }

      let newExpItems: ExperienceItem[] = [];
      if (Array.isArray(parsed.experiences)) {
        newExpItems = parsed.experiences.map((exp, idx) => {
          let safeBullets: string[] = [];
          if (Array.isArray(exp.bullets)) {
            safeBullets = exp.bullets.map(b => formatBulletText(b));
          }
          return {
            id: exp.id || `exp-imp-${Date.now()}-${idx}`,
            category: exp.category || 'experience',
            title: exp.title || 'Untitled Role',
            company: exp.company || 'Organization',
            period: exp.period || 'Present',
            location: exp.location || 'Remote',
            skills: Array.isArray(exp.skills) ? exp.skills : [],
            bullets: safeBullets
          };
        });
      }

      if (mode === 'replace') {
        setParsedProfile({
          name: parsed.name || '',
          title: parsed.title || '',
          email: parsed.email || '',
          phone: parsed.phone || '',
          location: parsed.location || '',
          summary: parsed.summary || '',
          experiences: newExpItems
        });
        setSelectedExpIds(new Set(newExpItems.map(e => e.id)));
      } else {
        setParsedProfile(prev => ({
          name: parsed.name || prev.name,
          title: parsed.title || prev.title,
          email: parsed.email || prev.email,
          phone: parsed.phone || prev.phone,
          location: parsed.location || prev.location,
          summary: parsed.summary || prev.summary,
          experiences: [...newExpItems, ...(prev.experiences || [])]
        }));
        setSelectedExpIds(prev => new Set([...newExpItems.map(e => e.id), ...Array.from(prev)]));
      }

      setIsPasteYamlOpen(false);
      setPasteYamlInput('');
    } catch (err: any) {
      setPasteYamlError(err?.message || 'Failed to parse YAML syntax.');
    }
  };

  const saveCardEditor = () => {
    if (!editingCard) return;
    const finalBullets = cardFormBulletList
      .filter(b => b.text.trim().length > 0)
      .map(b => ({ id: b.id, text: b.text.trim() }));

    const cardPayload: ExperienceItem = {
      ...editingCard.card,
      category: cardFormCategory,
      title: cardFormTitle || 'Untitled Card',
      company: cardFormCompany || (cardFormCategory === 'education' ? 'University / School' : cardFormCategory === 'project' ? 'Personal Project' : 'Organization'),
      period: cardFormPeriod || 'Present',
      location: cardFormLocation || 'Remote',
      skills: cardFormSkills.split(',').map(s => s.trim()).filter(Boolean),
      bullets: finalBullets
    };

    if (editingCard.target === 'master') {
      if (editingCard.isNew) {
        addExperienceCard(cardPayload);
        if (isCreatingResume) {
          setWizardSelectedExpIds(prev => new Set([...Array.from(prev), cardPayload.id]));
        }
      } else {
        updateExperienceCard(cardPayload.id, cardPayload);
      }
    } else if (editingCard.target === 'wizard') {
      const isExistingWizardCard = wizardCustomTailoredCards.some(c => c.id === editingCard.card.id);
      const isAlreadyAiTailored = Boolean(editingCard.card.isAiTailored);

      if (isExistingWizardCard) {
        setWizardCustomTailoredCards(prev => prev.map(c => {
          if (c.id !== editingCard.card.id) return c;
          return {
            ...cardPayload,
            isDeviatedFromMaster: !isAlreadyAiTailored
          };
        }));
      } else {
        // Editing a Master Card inside Resume Variant Wizard -> Create Resume-Specific Custom Card!
        const customCardId = `wizard-custom-${editingCard.card.id}-${Date.now()}`;
        const newVariantCard: ExperienceItem = {
          ...cardPayload,
          id: customCardId,
          isDeviatedFromMaster: !isAlreadyAiTailored,
          tailoredForRole: newResumeRole || 'Target Role'
        };

        setWizardCustomTailoredCards(prev => [newVariantCard, ...prev]);
        setWizardSelectedExpIds(prev => {
          const next = new Set(prev);
          next.delete(editingCard.card.id); // Unselect master card
          next.add(customCardId); // Select variant-specific edited card
          return next;
        });
      }
    } else if (editingCard.target === 'resume' && editingCard.resumeId) {
      if (editingCard.isNew) {
        addCustomResumeCard(editingCard.resumeId, cardPayload);
      } else {
        updateCustomResumeCard(editingCard.resumeId, editingCard.card.id, {
          ...cardPayload,
          isDeviatedFromMaster: true
        });
      }
    }

    setEditingCard(null);
  };

  const deleteResume = (resumeId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to delete this resume variant?")) {
      const nextResumes = resumes.filter(r => r.id !== resumeId);
      setResumes(nextResumes);
      if (activeResumeId === resumeId) {
        setActiveResumeId(nextResumes.length > 0 ? nextResumes[0].id : '');
      }
    }
  };

  const deleteJob = (jobId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (confirm("Are you sure you want to remove this job tracker entry?")) {
      setJobsList(prev => prev.filter(j => j.id !== jobId));
    }
  };

  const startCreateResumeWizard = () => {
    setEditingResumeId(null);
    setNewResumeTitle('');
    setNewResumeRole('');
    setShowStage1Company(false);
    setStage1CompanyName('');
    setStage1JobPostingText('');
    setCreateResumeStage(1);
    setWizardCategoryIndex(0);
    setWizardSelectedExpIds(new Set());
    setWizardExtraSkills(new Set());
    setWizardCustomTailoredCards([]);
    setCustomWizardSkillInput('');
    setIsCreatingResume(true);
  };



  const proceedToStage2 = () => {
    if (!newResumeTitle.trim()) return;
    setCreateResumeStage(2);
    setWizardCategoryIndex(0);

    // Pre-select education cards by default
    const eduCardIds = (parsedProfile?.experiences || [])
      .filter(e => (e.category || 'experience') === 'education')
      .map(e => e.id);

    setWizardSelectedExpIds(prev => new Set([...Array.from(prev), ...eduCardIds]));
  };

  const toggleWizardCardSelection = (cardId: string) => {
    setWizardSelectedExpIds(prev => {
      const next = new Set(prev);
      if (next.has(cardId)) {
        next.delete(cardId);
      } else {
        next.add(cardId);
      }
      return next;
    });
  };

  const toggleWizardExtraSkill = (skillName: string) => {
    setWizardExtraSkills(prev => {
      const next = new Set(prev);
      if (next.has(skillName)) {
        next.delete(skillName);
      } else {
        next.add(skillName);
      }
      return next;
    });
  };

  const addSkillToMasterBank = () => {
    if (!newSkillName.trim()) return;
    const skillToAttach = newSkillName.trim();

    if (newSkillTargetCardId) {
      setParsedProfile(prev => ({
        ...prev,
        experiences: (prev.experiences || []).map(exp => {
          if (exp.id !== newSkillTargetCardId) return exp;
          const currentSkills = exp.skills || [];
          if (currentSkills.includes(skillToAttach)) return exp;
          return { ...exp, skills: [...currentSkills, skillToAttach] };
        })
      }));
    } else {
      // Attach to the first experience/general card or create/update skills card
      const targetExp = (parsedProfile?.experiences || [])[0];
      if (targetExp) {
        setParsedProfile(prev => ({
          ...prev,
          experiences: (prev.experiences || []).map(exp => {
            if (exp.id !== targetExp.id) return exp;
            const currentSkills = exp.skills || [];
            if (currentSkills.includes(skillToAttach)) return exp;
            return { ...exp, skills: [...currentSkills, skillToAttach] };
          })
        }));
      }
    }

    setNewSkillName('');
    setNewSkillTargetCardId('');
  };

  const finishCreateResumeWizard = () => {
    const finalSkillsList = Array.from(new Set([
      ...autoFilledWizardSkills,
      ...Array.from(wizardExtraSkills)
    ]));

    const selectedCustomExps = wizardCustomTailoredCards.filter(c => wizardSelectedExpIds.has(c.id));

    if (editingResumeId) {
      // Save changes to existing resume variant
      const updatedResumes = resumes.map(r => {
        if (r.id !== editingResumeId) return r;
        return {
          ...r,
          title: newResumeTitle,
          targetRole: newResumeRole || stage1CompanyName || r.targetRole,
          company: stage1CompanyName || r.company,
          updatedAt: new Date().toISOString().split('T')[0],
          selectedExpIds: Array.from(wizardSelectedExpIds),
          selectedSkills: finalSkillsList,
          customExperiences: selectedCustomExps
        };
      });
      setResumes(updatedResumes);
      if (currentUser?.uid) {
        saveUserDataToFirestore(currentUser.uid, { resumes: updatedResumes });
      }
      setActiveResumeId(editingResumeId);
    } else {
      // Create brand new resume variant
      const newRes: ResumeItem = {
        id: `res-${Date.now()}`,
        title: newResumeTitle,
        targetRole: newResumeRole || stage1CompanyName || 'Role',
        company: stage1CompanyName || '',
        updatedAt: new Date().toISOString().split('T')[0],
        selectedExpIds: Array.from(wizardSelectedExpIds),
        selectedSkills: finalSkillsList,
        customExperiences: selectedCustomExps
      };

      const updatedResumes = [newRes, ...resumes];
      setResumes(updatedResumes);
      setActiveResumeId(newRes.id);

      if (currentUser?.uid) {
        saveUserDataToFirestore(currentUser.uid, { resumes: updatedResumes });
      }

      if (showStage1Company || stage1CompanyName.trim() || stage1JobPostingText.trim()) {
        const newJob: JobRecord = {
          id: `job-${Date.now()}`,
          company: stage1CompanyName.trim() || 'Target Company',
          title: newResumeRole.trim() || 'Role',
          dateAdded: new Date().toISOString().split('T')[0],
          status: 'Draft',
          description: stage1JobPostingText.trim(),
          resumeId: newRes.id,
          resumeTitle: newRes.title
        };
        setJobsList(prev => [newJob, ...prev]);
      }
    }

    setEditingResumeId(null);
    setIsCreatingResume(false);
  };

  const addExperienceCard = (card: ExperienceItem) => {
    setParsedProfile(prev => ({
      ...prev,
      experiences: [card, ...(prev.experiences || [])]
    }));
    setSelectedExpIds(prev => new Set([card.id, ...Array.from(prev)]));
  };

  const updateExperienceCard = (id: string, patch: Partial<ExperienceItem>) => {
    setParsedProfile(prev => ({
      ...prev,
      experiences: (prev.experiences || []).map(e => (e.id === id ? { ...e, ...patch } : e))
    }));
  };

  const removeExperienceCard = (id: string) => {
    setParsedProfile(prev => ({
      ...prev,
      experiences: (prev.experiences || []).filter(e => e.id !== id)
    }));
    setSelectedExpIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setResumes(prev =>
      prev.map(r => ({
        ...r,
        selectedExpIds: r.selectedExpIds.filter(eId => eId !== id)
      }))
    );
  };

  const updateCustomResumeCard = (resumeId: string, cardId: string, patch: Partial<ExperienceItem>) => {
    setResumes(prev =>
      prev.map(r => {
        if (r.id !== resumeId) return r;
        return {
          ...r,
          customExperiences: (r.customExperiences || []).map(c => (c.id === cardId ? { ...c, ...patch } : c))
        };
      })
    );
  };

  const addCustomResumeCard = (resumeId: string, card: ExperienceItem) => {
    setResumes(prev =>
      prev.map(r => {
        if (r.id !== resumeId) return r;
        return {
          ...r,
          customExperiences: [card, ...(r.customExperiences || [])]
        };
      })
    );
  };

  // Stage 2 category cards validation
  const currentCategory = SECTION_ORDER[wizardCategoryIndex];
  const masterCardsCurrentCat = (parsedProfile?.experiences || []).filter(
    e => (e.category || 'experience') === currentCategory
  );
  const aiCardsCurrentCat = wizardCustomTailoredCards.filter(
    c => (c.category || 'experience') === currentCategory
  );
  const unTailoredMasterCurrentCat = masterCardsCurrentCat.filter(
    m => !aiCardsCurrentCat.some(a => a.id.includes(m.id))
  );
  const combinedCategoryCardsCurrentCat = [...aiCardsCurrentCat, ...unTailoredMasterCurrentCat];
  const currentCategorySelectedCount = combinedCategoryCardsCurrentCat.filter(c => wizardSelectedExpIds.has(c.id)).length;

  // Validation: For about, experience, project, education allow proceeding if selected or section empty
  const canProceedCurrentCategory = currentCategory === 'skills'
    ? true
    : combinedCategoryCardsCurrentCat.length === 0 || currentCategorySelectedCount > 0;

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        <span className="text-xs text-slate-400 font-mono tracking-wider">Restoring Session...</span>
      </div>
    );
  }

  if (viewMode === 'splash' && !currentUser) {
    return <SplashPage onEnterApp={() => setViewMode('app')} currentUser={currentUser} />;
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans antialiased overflow-hidden select-none">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 md:hidden no-print"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-slate-900 border-r border-slate-800 flex flex-col justify-between transform transition-transform duration-300 ease-in-out no-print ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div>
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-600 rounded-lg text-white shadow-lg shadow-indigo-500/30">
                <Cpu className="w-6 h-6" />
              </div>
              <div>
                <h1 className="font-bold text-base text-white leading-tight">Resumix AI</h1>
                <span className="text-xs text-indigo-400 font-medium">Card Builder Engine</span>
              </div>
            </div>
            <button
              onClick={() => setIsMobileMenuOpen(false)}
              className="md:hidden text-slate-400 hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-3 space-y-1">
            <button
              onClick={() => { setActiveTab('resumes'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'resumes' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              <span>Resumes Manager</span>
              <span className="ml-auto text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-800 font-mono">
                {resumes.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('skills'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'skills' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Skills Bank</span>
              <span className="ml-auto text-xs bg-cyan-950 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-800 font-mono">
                {masterSkillsBank.length}
              </span>
            </button>

            <button
              onClick={() => { setActiveTab('feed'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'feed' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Experience Section</span>
            </button>

            <button
              onClick={() => { setActiveTab('jobs'); setIsMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                activeTab === 'jobs' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Briefcase className="w-4 h-4" />
              <span>Job Tracker</span>
            </button>
          </nav>
        </div>

        {/* System Status Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="text-xs space-y-2 text-slate-400">
            <div className="flex items-center justify-between">
              <span className="flex items-center space-x-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>Experience Engine</span>
              </span>
              <span className="text-emerald-400 font-mono">Active</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
        {/* Header Bar */}
        <header className="h-14 border-b border-slate-800 bg-slate-900/40 px-4 md:px-6 flex items-center justify-between no-print shrink-0">
          <div className="flex items-center space-x-3 text-sm text-slate-400">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition"
              aria-label="Toggle Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-semibold text-slate-200 capitalize">{activeTab}</span>
            {activeResume && activeTab === 'resumes' && (
              <>
                <span>/</span>
                <span className="text-indigo-400 font-medium truncate max-w-[150px] sm:max-w-xs">{activeResume.title}</span>
              </>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <button
              onClick={() => setViewMode('splash')}
              className="flex items-center space-x-1.5 bg-slate-850 hover:bg-slate-800 text-slate-300 border border-slate-750 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              title="Return to Landing Page"
            >
              <Home className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden sm:inline">Landing Page</span>
            </button>

            {currentUser && (
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={forceSyncToCloud}
                  disabled={isCloudSaving}
                  className="flex items-center space-x-1 bg-slate-900 hover:bg-slate-800 text-indigo-300 border border-slate-700 text-xs px-2.5 py-1 rounded-lg transition"
                  title="Force Sync All Resumes & Profile to Cloud Firestore"
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  <span className="hidden lg:inline">{isCloudSaving ? 'Syncing...' : 'Save to Cloud'}</span>
                </button>
                <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs">
                  <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-slate-300 font-medium hidden md:inline truncate max-w-[120px]">
                    {currentUser.email || 'User'}
                  </span>
                  <button
                    onClick={handleSignOut}
                    className="text-slate-500 hover:text-rose-400 transition p-0.5"
                    title="Sign Out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto">
          {activeTab === 'resumes' && (
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
              {/* Resume Styles Horizontal Bar */}
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 shadow-md no-print">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center space-x-2">
                    <Palette className="w-5 h-5 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">Resume Design Styles & Templates</h3>
                    <span className="text-[10px] bg-indigo-950 text-indigo-300 border border-indigo-800 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                      AI Compatible with All Resumes
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={openCreateResumeStyleModal}
                    className="flex items-center space-x-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow transition shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                    <span>+ Create AI Resume Style</span>
                  </button>
                </div>

                {/* Horizontal Scrollable List of Portrait Document Tiles */}
                <div className="overflow-x-auto max-w-full pt-3 pb-2 px-1">
                  <div className="flex space-x-3.5 min-w-max pt-1">
                    {resumeStyles.map(st => {
                      const isActive = activeStyleId === st.id;
                      return (
                        <div
                          key={st.id}
                          onClick={() => {
                            setActiveStyleId(st.id);
                            try {
                              localStorage.setItem('rt_active_style_id', st.id);
                            } catch (e) {}
                            if (currentUser?.uid) {
                              saveUserDataToFirestore(currentUser.uid, { activeStyleId: st.id });
                            }
                          }}
                          className={`cursor-pointer group relative transition-all ${
                            isActive ? 'ring-2 ring-indigo-500 scale-[1.03] shadow-xl' : 'opacity-90 hover:opacity-100'
                          }`}
                        >
                          <MiniResumeDocumentTile 
                            style={st} 
                            profileName={parsedProfile.name}
                            profileTitle={parsedProfile.title}
                            className="w-40 h-52"
                          />

                          {/* Edit & Delete Action Controls on Hover */}
                          <div className="absolute top-2 right-2 flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition z-10">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditResumeStyleModal(st);
                              }}
                              className="p-1 bg-slate-900/90 hover:bg-indigo-900/90 text-slate-300 hover:text-indigo-200 rounded-md transition border border-slate-700/60 shadow"
                              title="Edit & Refine Style Design with AI"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            {resumeStyles.length > 1 && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteResumeStyle(st.id);
                                }}
                                className="p-1 bg-slate-900/90 hover:bg-rose-900/90 text-slate-400 hover:text-rose-200 rounded-md transition border border-slate-700/60 shadow"
                                title="Delete Resume Style"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          {isActive && (
                            <span className="absolute -top-2.5 right-1.5 bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-lg border border-indigo-400 z-10">
                              ✓ Active
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Header Bar with Pop-up Create Button */}
              <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 no-print">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                    <FolderKanban className="w-5 h-5 text-indigo-400" />
                    <span>Resumes Manager</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Select a resume variant from the list to view its live preview on the right.
                  </p>
                </div>

                <button
                  onClick={startCreateResumeWizard}
                  className="flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg shadow-lg transition w-full sm:w-auto shrink-0"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create Resume Variant</span>
                </button>
              </div>

              {/* 2-Stage Pop-up Wizard Modal for Create Resume */}
              {isCreatingResume && (
                <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
                  <div className="bg-slate-900 border border-indigo-500/50 w-full max-w-2xl rounded-xl p-4 sm:p-6 shadow-2xl space-y-4 sm:space-y-5 animate-in fade-in max-h-[92vh] flex flex-col">
                    {/* Modal Header */}
                    <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                      <div>
                        <h2 className="text-base font-bold text-white flex items-center space-x-2">
                          <Sparkles className="w-5 h-5 text-indigo-400" />
                          <span>
                            {createResumeStage === 1 ? 'Stage 1: Resume Initial Setup' : 'Stage 2: Master Card & Skills Wizard'}
                          </span>
                        </h2>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {createResumeStage === 1 ? 'Specify resume variant details and job requirements' : 'Select cards in sequence: About → Experience → Projects → Education → Skills'}
                        </p>
                      </div>
                      <button
                        onClick={() => setIsCreatingResume(false)}
                        className="text-slate-400 hover:text-slate-200 text-xs font-mono"
                      >
                        ✕
                      </button>
                    </div>

                    {/* Stage 1 Content */}
                    {createResumeStage === 1 && (
                      <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Resume Variant Title *</label>
                          <input
                            type="text"
                            value={newResumeTitle}
                            onChange={(e) => setNewResumeTitle(e.target.value)}
                            placeholder="e.g. Senior Frontend Architect Resume"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-slate-300 mb-1">Role</label>
                          <input
                            type="text"
                            value={newResumeRole}
                            onChange={(e) => setNewResumeRole(e.target.value)}
                            placeholder="e.g. Lead React Developer"
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                          />
                        </div>

                        <div className="pt-1">
                          <button
                            type="button"
                            onClick={() => setShowStage1Company(!showStage1Company)}
                            className="text-xs text-indigo-400 hover:underline font-semibold flex items-center space-x-1"
                          >
                            <span>{showStage1Company ? '- Hide Job Posting' : '+ Add Job Posting'}</span>
                          </button>
                        </div>

                        {showStage1Company && (
                          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                            <div>
                              <label className="block text-[11px] font-medium text-slate-400 mb-1">Target Company Name (Optional)</label>
                              <input
                                type="text"
                                value={stage1CompanyName}
                                onChange={(e) => setStage1CompanyName(e.target.value)}
                                placeholder="e.g. Stripe / Datadog"
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-slate-400 mb-1">Job Description Requirements</label>
                              <textarea
                                value={stage1JobPostingText}
                                onChange={(e) => setStage1JobPostingText(e.target.value)}
                                placeholder="Paste job posting text here and click AI Tailor to auto-match and rewrite matching cards..."
                                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 h-28 resize-none"
                              />
                              <button
                                type="button"
                                onClick={handleAiTailorJobPost}
                                disabled={!stage1JobPostingText.trim() || isLlmGenerating}
                                className="mt-2.5 w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white text-xs font-bold py-2.5 rounded-lg shadow-lg transition"
                              >
                                {isLlmGenerating ? (
                                  <>
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                    <span>Analyzing & Rewriting Cards with Spark AI...</span>
                                  </>
                                ) : (
                                  <>
                                    <Wand2 className="w-4 h-4 text-purple-300" />
                                    <span>Run AI Tailor & Proceed to Card Selection →</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stage 2 Content: Card & Skills Selection Wizard */}
                    {createResumeStage === 2 && (
                      <div className="space-y-4 overflow-y-auto pr-1 flex-1">
                        {/* Wizard Stepper Tabs Header - Horizontally Scrollable on Mobile */}
                        <div className="overflow-x-auto max-w-full pb-1 sm:pb-0">
                          <div className="flex border-b border-slate-800 bg-slate-950/80 rounded-lg p-1 space-x-1 min-w-max">
                            {SECTION_ORDER.map((sec, idx) => {
                              const isCurrent = wizardCategoryIndex === idx;
                              const masterCardsSec = (parsedProfile?.experiences || []).filter(e => (e.category || 'experience') === sec);
                              const customCardsSec = wizardCustomTailoredCards.filter(c => (c.category || 'experience') === sec);
                              const unTailoredMasterSec = masterCardsSec.filter(m => !customCardsSec.some(a => a.id.includes(m.id)));
                              const combinedCardsSec = [...customCardsSec, ...unTailoredMasterSec];
                              const selectedCount = sec === 'skills' 
                                ? (autoFilledWizardSkills.length + wizardExtraSkills.size)
                                : combinedCardsSec.filter(c => wizardSelectedExpIds.has(c.id)).length;

                              return (
                                <button
                                  key={sec}
                                  onClick={() => setWizardCategoryIndex(idx)}
                                  className={`px-3 py-2 rounded-md text-xs font-semibold capitalize transition flex items-center space-x-1.5 ${
                                    isCurrent
                                      ? 'bg-indigo-600 text-white shadow'
                                      : selectedCount > 0
                                      ? 'bg-slate-850 text-emerald-400 border border-emerald-500/30'
                                      : 'text-slate-400 hover:text-slate-200'
                                  }`}
                                >
                                  <span>{sec === 'about' ? 'About Me' : sec}</span>
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                                    isCurrent ? 'bg-indigo-800 text-white' : 'bg-slate-800 text-slate-300'
                                  }`}>
                                    {selectedCount}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Step Category Helper Message */}
                        <div className="flex items-center justify-between bg-slate-950 px-3.5 py-2 rounded-lg border border-slate-800 text-xs gap-2 flex-wrap">
                          <span className="text-slate-300 font-medium capitalize">
                            Selecting <strong className="text-indigo-400">{currentCategory}</strong> {currentCategory === 'skills' ? 'Bank' : 'Cards'}
                          </span>

                          <span className={`font-semibold ${canProceedCurrentCategory ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {currentCategory === 'skills'
                              ? `✓ ${autoFilledWizardSkills.length + wizardExtraSkills.size} selected`
                              : `${currentCategorySelectedCount} selected`}
                          </span>
                        </div>

                        {/* If current step is SKILLS (Step 5, after Education) */}
                        {currentCategory === 'skills' ? (
                          <div className="space-y-4">
                            {/* Auto-filled skills section */}
                            <div className="bg-slate-950 p-4 rounded-xl border border-indigo-500/30 space-y-2">
                              <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center space-x-1.5">
                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                <span>Auto-filled Skills from Selected Cards</span>
                              </h4>
                              <p className="text-[11px] text-slate-400">
                                Skills attached to the Experience & Education cards selected in previous steps:
                              </p>
                              <div className="flex flex-wrap gap-1.5 pt-1">
                                {autoFilledWizardSkills.length === 0 ? (
                                  <span className="text-xs text-slate-500 italic">No attached skills detected in previous steps. Pick from the Skills Bank below.</span>
                                ) : (
                                  autoFilledWizardSkills.map((sk) => (
                                    <span
                                      key={sk}
                                      className="text-xs bg-indigo-950 text-indigo-300 border border-indigo-800 px-2.5 py-1 rounded-md font-mono flex items-center space-x-1"
                                    >
                                      <span>✓ {sk}</span>
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>

                            {/* Additional Skills from Master Skills Bank */}
                            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-1.5">
                                  <Wrench className="w-4 h-4 text-cyan-400" />
                                  <span>Add Additional Skills from Master Skills Bank</span>
                                </h4>
                              </div>

                              <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
                                {(() => {
                                  const masterNames = masterSkillsBank.map(s => s.skillName);
                                  const extraNames = Array.from(wizardExtraSkills);
                                  const combinedNames = Array.from(new Set([...masterNames, ...extraNames]));

                                  return combinedNames.map(skillName => {
                                    const isAuto = autoFilledWizardSkills.includes(skillName);
                                    const isExtra = wizardExtraSkills.has(skillName);
                                    const isSelected = isAuto || isExtra;

                                    return (
                                      <button
                                        key={skillName}
                                        type="button"
                                        disabled={isAuto}
                                        onClick={() => toggleWizardExtraSkill(skillName)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition flex items-center space-x-1.5 ${
                                          isAuto
                                            ? 'bg-slate-900 border-slate-700 text-slate-400 opacity-60 cursor-not-allowed'
                                            : isExtra
                                            ? 'bg-cyan-950 text-cyan-300 border-cyan-500 shadow-md font-bold'
                                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
                                        }`}
                                      >
                                        <span>{isSelected ? '✓' : '+'}</span>
                                        <span>{skillName}</span>
                                        {isAuto && <span className="text-[9px] bg-slate-800 text-slate-400 px-1 rounded">Auto</span>}
                                      </button>
                                    );
                                  });
                                })()}
                              </div>

                              {/* Custom skill input */}
                              <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
                                <input
                                  type="text"
                                  value={customWizardSkillInput}
                                  onChange={(e) => setCustomWizardSkillInput(e.target.value)}
                                  placeholder="Add extra skill to resume..."
                                  className="w-full sm:flex-1 bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (!customWizardSkillInput.trim()) return;
                                    toggleWizardExtraSkill(customWizardSkillInput.trim());
                                    setCustomWizardSkillInput('');
                                  }}
                                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-3 py-1.5 rounded-lg transition shrink-0 w-full sm:w-auto text-center"
                                >
                                  + Add Skill
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Cards List for Standard Wizard Category */
                          <div className="space-y-2.5 max-h-80 overflow-y-auto">
                            {combinedCategoryCardsCurrentCat.length === 0 ? (
                              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center space-y-3">
                                <p className="text-xs text-slate-400">
                                  No <strong className="capitalize">{currentCategory}</strong> entries found in your master experience repository.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => openCardEditor('master', undefined, undefined, currentCategory)}
                                  className="inline-flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Add First {currentCategory} Entry</span>
                                </button>
                              </div>
                            ) : (
                                <div className="space-y-2.5">
                                  {(() => {
                                    const masterCards = (parsedProfile?.experiences || []).filter(e => (e.category || 'experience') === currentCategory);
                                    const aiCards = wizardCustomTailoredCards.filter(c => (c.category || 'experience') === currentCategory);
                                    const unTailoredMasterCards = masterCards.filter(m => !aiCards.some(a => a.id.includes(m.id)));
                                    const combinedCategoryCards = [...aiCards, ...unTailoredMasterCards];

                                    return combinedCategoryCards.map((exp) => {
                                      const isSelected = wizardSelectedExpIds.has(exp.id);
                                      const isDeviatedNotAi = exp.isDeviatedFromMaster && !exp.isAiTailored;
                                      return (
                                        <div
                                          key={exp.id}
                                          onClick={() => toggleWizardCardSelection(exp.id)}
                                          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                                            isSelected
                                              ? isDeviatedNotAi
                                                ? 'bg-slate-950 border-amber-500/80 shadow-md ring-1 ring-amber-500/40'
                                                : 'bg-slate-950 border-indigo-500 shadow-md'
                                              : 'bg-slate-950/40 border-slate-800 opacity-60 hover:opacity-90'
                                          }`}
                                        >
                                          <div className="flex items-start justify-between">
                                            <div className="flex items-center space-x-3">
                                              <div className={`p-1.5 rounded-md transition ${isSelected ? (isDeviatedNotAi ? 'bg-amber-600 text-white' : 'bg-indigo-600 text-white') : 'bg-slate-800 text-slate-500'}`}>
                                                <CheckCircle2 className="w-4 h-4" />
                                              </div>
                                              <div>
                                                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                                  <h4 className="font-bold text-sm text-slate-100">{exp.title}</h4>
                                                  {exp.isAiTailored && (
                                                    <span className="inline-flex items-center space-x-1 bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                      <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                                                      <span>AI Tailored for {exp.tailoredForRole || 'Job Posting'}</span>
                                                    </span>
                                                  )}
                                                  {isDeviatedNotAi && (
                                                    <span className="inline-flex items-center space-x-1 bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                      <GitFork className="w-3 h-3 text-amber-400 shrink-0" />
                                                      <span>Variant Override (Edited to fit position)</span>
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="text-xs text-indigo-400 font-medium">
                                                  {exp.company} {exp.period ? `• ${exp.period}` : ''}
                                                </span>
                                              </div>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                openCardEditor('wizard', exp);
                                              }}
                                              className="flex items-center space-x-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2 py-1 rounded-lg transition font-semibold shrink-0"
                                              title="Edit Card for this Resume Variant"
                                            >
                                              <Edit3 className="w-3 h-3 text-indigo-400" />
                                              <span>Edit</span>
                                            </button>
                                          </div>

                                          {exp.skills && exp.skills.length > 0 && (
                                            <div className="mt-2 flex flex-wrap gap-1">
                                              {exp.skills.map((s, i) => (
                                                <span key={i} className="text-[10px] bg-slate-900 text-indigo-300 px-2 py-0.5 rounded border border-slate-800">
                                                  {s}
                                                </span>
                                              ))}
                                            </div>
                                          )}

                                        {exp.category === 'about' ? (
                                          <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                                            {formatBulletText(exp.bullets?.[0] || '')}
                                          </p>
                                        ) : (
                                          <ul className="mt-2.5 space-y-1 text-xs text-slate-300 list-disc list-inside">
                                            {exp.bullets?.map((b, i) => (
                                              <li key={i}>{formatBulletText(b)}</li>
                                            ))}
                                          </ul>
                                        )}
                                        </div>
                                      );
                                    });
                                  })()}

                                  <div className="pt-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => openCardEditor('master', undefined, undefined, currentCategory)}
                                      className="inline-flex items-center space-x-1.5 bg-slate-850 hover:bg-slate-800 text-indigo-300 border border-slate-700 text-xs font-semibold px-4 py-2 rounded-lg transition shadow"
                                    >
                                      <Plus className="w-3.5 h-3.5" />
                                      <span>Add Another {currentCategory} Entry</span>
                                    </button>
                                  </div>
                                </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Modal Footer Controls */}
                    <div className="flex flex-col sm:flex-row gap-2.5 sm:justify-between sm:items-center border-t border-slate-800 pt-4">
                      {createResumeStage === 1 ? (
                        <>
                          <button
                            onClick={() => setIsCreatingResume(false)}
                            className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition w-full sm:w-auto"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={proceedToStage2}
                            disabled={!newResumeTitle.trim()}
                            className="flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold px-5 py-2 rounded-lg shadow transition w-full sm:w-auto"
                          >
                            <span>Next: Select Cards</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              if (wizardCategoryIndex > 0) {
                                setWizardCategoryIndex(prev => prev - 1);
                              } else {
                                setCreateResumeStage(1);
                              }
                            }}
                            className="flex items-center justify-center space-x-1 px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition w-full sm:w-auto"
                          >
                            <ChevronLeft className="w-4 h-4" />
                            <span>{wizardCategoryIndex === 0 ? '← Back to Setup' : 'Previous Step'}</span>
                          </button>

                          <button
                            disabled={!canProceedCurrentCategory}
                            onClick={() => {
                              if (wizardCategoryIndex < SECTION_ORDER.length - 1) {
                                setWizardCategoryIndex(prev => prev + 1);
                              } else {
                                finishCreateResumeWizard();
                              }
                            }}
                            className={`flex items-center justify-center space-x-1.5 px-5 py-2 text-xs font-bold rounded-lg shadow transition w-full sm:w-auto ${
                              canProceedCurrentCategory
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                            }`}
                          >
                            <span>
                              {wizardCategoryIndex === SECTION_ORDER.length - 1 ? 'Finish & Create Resume' : 'Next Section'}
                            </span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* 2-Column Side-by-Side View: Resumes List on Left, Live ATS Resume Preview on Right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Left Column: Resumes List */}
                <div className="lg:col-span-4 space-y-6 no-print">
                  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3 shadow-lg">
                    <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Resumes ({resumes.length})
                    </h3>

                    <div className="space-y-2.5">
                      {resumes.map(r => {
                        const isActive = r.id === activeResumeId;
                        return (
                          <div
                            key={r.id}
                            onClick={() => setActiveResumeId(r.id)}
                            className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                              isActive
                                ? 'bg-indigo-950/40 border-indigo-500 shadow-md shadow-indigo-950/40'
                                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                <FolderKanban className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                                <h4 className="font-bold text-sm text-slate-100">{r.title}</h4>
                              </div>
                              <button
                                onClick={(e) => deleteResume(r.id, e)}
                                className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded transition text-xs"
                                title="Delete Resume Variant"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="mt-2 flex items-center justify-between text-xs gap-2">
                              <span className="bg-slate-800 text-indigo-300 px-2 py-0.5 rounded text-[11px] font-medium truncate">
                                {r.targetRole}
                              </span>
                              <div className="flex items-center space-x-1.5 shrink-0">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditResumeWizard(r);
                                  }}
                                  className="flex items-center space-x-1 text-[11px] bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 px-2 py-0.5 rounded transition font-semibold"
                                  title="Edit Resume Variant"
                                >
                                  <Edit3 className="w-3 h-3 text-indigo-400" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveResumeId(r.id);
                                    setTimeout(() => window.print(), 100);
                                  }}
                                  className="flex items-center space-x-1 text-[11px] bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-700/60 px-2 py-0.5 rounded transition font-semibold"
                                  title="Vector Print PDF (100% ATS Compatible)"
                                >
                                  <Printer className="w-3 h-3 text-indigo-400" />
                                  <span>Print ATS PDF</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Resume Preview */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5 rounded-t-xl border border-slate-800 text-xs text-slate-400 no-print">
                    <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                      <Eye className="w-4 h-4 text-indigo-400" />
                      <span>Live ATS Resume Preview</span>
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded font-mono border border-indigo-900">
                        {activeResume ? activeResume.title : 'No Resume Selected'}
                      </span>
                      {activeResume && (
                        <button
                          type="button"
                          onClick={() => window.print()}
                          className="flex items-center space-x-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs px-4 py-1.5 rounded-lg shadow-md transition"
                          title="Native Vector Print to PDF (100% Highlightable Text & ATS Compatible)"
                        >
                          <Printer className="w-4 h-4 text-indigo-200" />
                          <span>Download / Print ATS PDF</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {!activeResume || resumes.length === 0 ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-b-xl p-12 text-center space-y-4 shadow-xl min-h-[500px] flex flex-col items-center justify-center">
                      <div className="p-4 bg-indigo-950/60 border border-indigo-800 rounded-full w-16 h-16 flex items-center justify-center text-indigo-400">
                        <FolderKanban className="w-8 h-8" />
                      </div>
                      <div className="space-y-1 max-w-md">
                        <h3 className="text-lg font-bold text-white">No Resume Variant Selected</h3>
                        <p className="text-xs text-slate-400 leading-relaxed">
                          Create your first resume variant using the <strong className="text-indigo-300">+ Create Resume Variant</strong> button above to customize cards and preview live ATS output!
                        </p>
                      </div>
                      <button
                        onClick={startCreateResumeWizard}
                        className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-lg shadow-lg shadow-indigo-950/50 transition"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Create First Resume Variant</span>
                      </button>
                    </div>
                  ) : (
                    <div 
                      id="resume-document-pdf-area"
                      className="p-6 sm:p-8 pb-12 sm:pb-16 rounded-b-xl shadow-xl space-y-5 leading-normal min-h-[600px] overflow-x-auto print-area transition-all border-none"
                      style={{
                        backgroundColor: activeStyle.theme.bgColor,
                        color: activeStyle.theme.textColor,
                        fontFamily: activeStyle.theme.fontFamily === 'serif' || activeStyle.theme.fontFamily === 'playfair' ? 'Georgia, serif' : activeStyle.theme.fontFamily === 'mono' ? 'Courier New, monospace' : activeStyle.theme.fontFamily === 'outfit' || activeStyle.theme.fontFamily === 'space-grotesk' ? 'Outfit, sans-serif' : 'Inter, sans-serif'
                      }}
                    >
                    {/* Dynamic Header Layout Renderer */}
                    {activeStyle.theme.headerAlignment === 'split-right' ? (
                      <div 
                        className={`transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${activeStyle.theme.headerBgColor ? 'p-4 rounded-xl shadow-md mb-2' : ''}`}
                        style={{
                          backgroundColor: activeStyle.theme.headerBgColor || 'transparent'
                        }}
                      >
                        <div>
                          <h1 
                            className="text-2xl font-bold tracking-tight uppercase"
                            style={{ color: activeStyle.theme.headerTextColor || activeStyle.theme.primaryColor }}
                          >
                            {parsedProfile.name}
                          </h1>
                          <p className="text-xs font-semibold mt-0.5" style={{ color: activeStyle.theme.headerTextColor ? activeStyle.theme.headerTextColor : activeStyle.theme.secondaryColor }}>
                            {activeResume?.targetRole || parsedProfile.title}
                          </p>
                        </div>
                        <div className="text-[11px] opacity-80 sm:text-right space-y-0.5" style={{ color: activeStyle.theme.headerTextColor || activeStyle.theme.textColor }}>
                          <div>{parsedProfile.email}</div>
                          <div>{parsedProfile.phone} • {parsedProfile.location}</div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        className={`transition-all ${
                          activeStyle.theme.headerAlignment === 'left' ? 'text-left' :
                          activeStyle.theme.headerAlignment === 'right' ? 'text-right' : 'text-center'
                        } ${activeStyle.theme.layout === 'header-banner' || activeStyle.theme.headerBgColor ? 'p-4 rounded-xl shadow-md mb-2' : ''}`}
                        style={{
                          backgroundColor: activeStyle.theme.headerBgColor || 'transparent'
                        }}
                      >
                        <h1 
                          className="text-2xl font-bold tracking-tight uppercase"
                          style={{ color: activeStyle.theme.headerTextColor || activeStyle.theme.primaryColor }}
                        >
                          {parsedProfile.name}
                        </h1>
                        <p className="text-xs font-semibold mt-0.5" style={{ color: activeStyle.theme.headerTextColor ? activeStyle.theme.headerTextColor : activeStyle.theme.secondaryColor }}>
                          {activeResume?.targetRole || parsedProfile.title}
                        </p>
                        <p className="text-[11px] opacity-80 mt-0.5" style={{ color: activeStyle.theme.headerTextColor || activeStyle.theme.textColor }}>
                                {parsedProfile.email} • {parsedProfile.phone} • {parsedProfile.location}
                        </p>
                      </div>
                    )}
                    {!(activeStyle.theme.layout === 'header-banner' || activeStyle.theme.headerBgColor) && (
                      <div className="w-full h-[2px] mt-2 mb-3" style={{ backgroundColor: activeStyle.theme.dividerColor || '#cbd5e1' }} />
                    )}

                    {/* 100% Single Column ATS Layout Stream */}
                    <div className={`space-y-6 ${activeStyle.theme.layout === 'brand-margin-stripe' ? 'pl-4 border-l-8' : ''}`} style={{ borderColor: activeStyle.theme.stripeColor || activeStyle.theme.primaryColor }}>
                        {/* 1. About Me */}
                        {(() => {
                          const items = (parsedProfile?.experiences || []).filter(e => 
                            (e.category || 'experience') === 'about' && (activeResume?.selectedExpIds?.includes(e.id) ?? false)
                          );
                          const customItems = (activeResume?.customExperiences || []).filter(c => (c.category || 'experience') === 'about');
                          const unTailoredItems = items.filter(m => !customItems.some(c => c.id.includes(m.id)));
                          const totalAboutItems = [...customItems, ...unTailoredItems];
                          if (totalAboutItems.length === 0) return null;

                          return (
                            <div className="space-y-1 mb-2">
                              <h2 
                                className="text-[13px] font-bold uppercase tracking-wider leading-none pt-2 pb-1.5"
                                style={{ color: activeStyle.theme.primaryColor, pageBreakAfter: 'avoid', breakAfter: 'avoid' }}
                              >
                                About Me
                              </h2>
                              <div className="w-full h-[1.5px] mt-0.5 mb-2.5" style={{ backgroundColor: activeStyle.theme.dividerColor || '#cbd5e1' }} />
                              {totalAboutItems.map(exp => (
                                <p key={exp.id} className="text-[11px] leading-relaxed" style={{ color: activeStyle.theme.textColor }}>
                                  {formatBulletText(exp.bullets?.[0] || '')}
                                </p>
                              ))}
                            </div>
                          );
                        })()}

                        {/* 2. Technical Skills & Core Competencies */}
                        {(() => {
                          const activeSkills = activeResume?.selectedSkills && activeResume.selectedSkills.length > 0
                            ? activeResume.selectedSkills
                            : autoFilledWizardSkills;

                          if (!activeSkills || activeSkills.length === 0) return null;

                          const displayStyle = activeStyle.theme.skillsDisplayStyle || 'comma-separated';

                          return (
                            <div className="space-y-1 mb-2">
                              <h2 
                                className="text-[13px] font-bold uppercase tracking-wider leading-none pt-2 pb-1.5"
                                style={{ color: activeStyle.theme.primaryColor, pageBreakAfter: 'avoid', breakAfter: 'avoid' }}
                              >
                                Technical Skills & Core Competencies
                              </h2>
                              <div className="w-full h-[1.5px] mt-0.5 mb-2.5" style={{ backgroundColor: activeStyle.theme.dividerColor || '#cbd5e1' }} />
                              {displayStyle === 'pill-badges' ? (
                                <div className="flex flex-wrap gap-1.5 pt-0.5">
                                  {activeSkills.map(sk => (
                                    <span
                                      key={sk}
                                      className="pdf-break-target text-[10px] px-2.5 pt-1 pb-1.5 rounded-full font-semibold border shadow-xs inline-block leading-none align-middle"
                                      style={{
                                        borderColor: activeStyle.theme.dividerColor,
                                        color: activeStyle.theme.textColor,
                                        backgroundColor: activeStyle.theme.cardBgColor || activeStyle.theme.bgColor
                                      }}
                                    >
                                      {sk}
                                    </span>
                                  ))}
                                </div>
                              ) : displayStyle === 'bulleted-grid' ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]" style={{ color: activeStyle.theme.textColor }}>
                                  {activeSkills.map(sk => (
                                    <div key={sk} className="flex items-center space-x-1">
                                      <span style={{ color: activeStyle.theme.accentColor }}>•</span>
                                      <span>{sk}</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-[11px] leading-relaxed" style={{ color: activeStyle.theme.textColor }}>
                                  {activeSkills.join(' • ')}
                                </p>
                              )}
                            </div>
                          );
                        })()}

                        {/* 3. Section Cards */}
                        {SECTION_ORDER.filter(s => s !== 'skills' && s !== 'about').map(sec => {
                          const items = (parsedProfile?.experiences || []).filter(e => 
                            (e.category || 'experience') === sec && (activeResume?.selectedExpIds?.includes(e.id) ?? false)
                          );
                          const customItems = (activeResume?.customExperiences || []).filter(c => (c.category || 'experience') === sec);
                          const unTailoredItems = items.filter(m => !customItems.some(c => c.id.includes(m.id)));
                          const totalItems = [...customItems, ...unTailoredItems];
                          if (totalItems.length === 0) return null;

                          return (
                            <div key={sec} className="space-y-2">
                              <h2 
                                className="text-[13px] font-bold uppercase tracking-wider leading-none pt-2 pb-1.5 capitalize"
                                style={{ color: activeStyle.theme.primaryColor, pageBreakAfter: 'avoid', breakAfter: 'avoid' }}
                              >
                                {sec}
                              </h2>
                              <div className="w-full h-[1.5px] mt-0.5 mb-2.5" style={{ backgroundColor: activeStyle.theme.dividerColor || '#cbd5e1' }} />
                              {totalItems.map(exp => {
                                return (
                                      <div key={exp.id} className={`w-full pdf-card-block mb-3.5 space-y-0.5 ${activeStyle.theme.layout === 'cards-modern' ? 'p-3.5 rounded-xl border shadow-sm' : ''}`} style={{ backgroundColor: activeStyle.theme.layout === 'cards-modern' ? (activeStyle.theme.cardBgColor || activeStyle.theme.bgColor) : 'transparent', borderColor: activeStyle.theme.dividerColor }}>
                                        <div className="text-[11.5px] leading-snug">
                                           <span className="font-bold" style={{ color: activeStyle.theme.textColor }}>
                                             {exp.title}
                                           </span>
                                           {exp.period && exp.period.trim() && exp.period.trim() !== 'N/A' && (
                                             <span className="font-semibold opacity-80 pl-2" style={{ color: activeStyle.theme.secondaryColor }}>
                                               • {exp.period}
                                             </span>
                                           )}
                                         </div>
                                         {(exp.company || exp.location) && (
                                           <div className="text-[10.5px] leading-snug opacity-90">
                                             <span className="font-medium italic" style={{ color: activeStyle.theme.secondaryColor }}>
                                               {exp.company && exp.company.trim() !== 'Personal Project' && exp.company.trim() !== 'N/A' ? exp.company : ''}
                                             </span>
                                             {exp.location && exp.location.trim() && exp.location.trim() !== 'Remote' && exp.location.trim() !== 'N/A' && (
                                               <span className="opacity-75 pl-2" style={{ color: activeStyle.theme.textColor }}>
                                                 • {exp.location}
                                               </span>
                                             )}
                                           </div>
                                         )}
                                        {exp.skills && exp.skills.length > 0 && (
                                          <div className="text-[10px] opacity-70 text-left pb-0.5" style={{ color: activeStyle.theme.accentColor }}>
                                            Skills: {exp.skills.join(', ')}
                                          </div>
                                        )}
                                        {exp.bullets && exp.bullets.length > 0 && (
                                          <div className="text-[11px] opacity-90 text-left pt-0.5" style={{ color: activeStyle.theme.textColor }}>
                                            <ul className="space-y-1 pl-1">
                                              {exp.bullets.map((b, i) => (
                                                <li key={i} className="flex items-start space-x-2">
                                                  <span className="select-none shrink-0 text-[10px] leading-relaxed font-bold mt-[1px]" style={{ color: activeStyle.theme.accentColor || activeStyle.theme.primaryColor }}>•</span>
                                                  <span className="flex-1 leading-relaxed">{formatBulletText(b)}</span>
                                                </li>
                                              ))}
                                            </ul>
                                          </div>
                                        )}
                                      </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Master Skills Bank Dedicated Tab */}
          {activeTab === 'skills' && (
            <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-800 shadow-md">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                    <Wrench className="w-5 h-5 text-indigo-400" />
                    <span>Skills Bank Dashboard</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Central bank of technical skills attached to your Experience and Education entries.
                  </p>
                </div>
                
                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={skillsSearchQuery}
                    onChange={(e) => setSkillsSearchQuery(e.target.value)}
                    placeholder="Search Skills Bank..."
                    className="bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 w-full"
                  />
                </div>
              </div>

              {/* Add Skill to Bank Form */}
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3 shadow-md max-w-full overflow-hidden">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-indigo-400" />
                  <span>Add Skill to Master Bank</span>
                </h3>
                <div className="flex flex-col sm:flex-row gap-3 max-w-full">
                  <input
                    type="text"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="Skill Name (e.g. PyTorch, Kubernetes, GraphQL)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 min-w-0"
                  />

                  <select
                    value={newSkillTargetCardId}
                    onChange={(e) => setNewSkillTargetCardId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 max-w-full sm:max-w-xs truncate"
                  >
                    <option value="">Attach to Entry (Optional)</option>
                    {(parsedProfile?.experiences || []).map(exp => (
                      <option key={exp.id} value={exp.id}>
                        {exp.title} ({exp.company})
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={addSkillToMasterBank}
                    disabled={!newSkillName.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow w-full sm:w-auto shrink-0 whitespace-nowrap"
                  >
                    + Add to Bank
                  </button>
                </div>
              </div>

              {/* Skills Bank List View Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto w-full">
                  <div className="min-w-[640px]">
                    <div className="px-5 py-3 bg-slate-850 border-b border-slate-800 flex items-center justify-between text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      <div className="w-1/4">Skill Name</div>
                      <div className="w-1/2">Attached Experience & Education Entries</div>
                      <div className="w-1/4 text-right">Card Count</div>
                    </div>

                    <div className="divide-y divide-slate-800">
                      {masterSkillsBank
                        .filter(({ skillName }) => skillName.toLowerCase().includes(skillsSearchQuery.toLowerCase()))
                        .map(({ skillName, attachedCards }) => (
                          <div
                            key={skillName}
                            className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-850/60 transition gap-4 text-xs"
                          >
                            {/* Skill Name */}
                            <div className="w-1/4 flex items-center space-x-2 font-mono font-bold text-indigo-300">
                              <Tag className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                              <span className="truncate">{skillName}</span>
                            </div>

                            {/* Attached Entries Pills */}
                            <div className="w-1/2 flex flex-wrap gap-1.5 items-center">
                              {attachedCards.length === 0 ? (
                                <span className="text-slate-500 italic text-[11px]">Standalone Skill</span>
                              ) : (
                                attachedCards.map(({ cardId, cardTitle, company, category }) => (
                                  <span
                                    key={cardId}
                                    className="inline-flex items-center space-x-1 bg-slate-950 border border-slate-800 text-slate-200 px-2 py-0.5 rounded text-[11px]"
                                  >
                                    <span className="font-semibold text-slate-200 truncate max-w-[140px]">{company || cardTitle}</span>
                                    <span className={`text-[9px] uppercase px-1 rounded font-bold ${
                                      category === 'experience' ? 'bg-indigo-950 text-indigo-300' :
                                      category === 'education' ? 'bg-amber-950 text-amber-300' :
                                      'bg-purple-950 text-purple-300'
                                    }`}>
                                      {category}
                                    </span>
                                  </span>
                                ))
                              )}
                            </div>

                            {/* Card Count Badge */}
                            <div className="w-1/4 text-right font-mono text-[11px]">
                              <span className={`px-2.5 py-0.5 rounded border ${
                                attachedCards.length > 0
                                  ? 'bg-indigo-950/80 text-indigo-300 border-indigo-800'
                                  : 'bg-slate-800 text-slate-400 border-slate-700'
                              }`}>
                                {attachedCards.length} {attachedCards.length === 1 ? 'Entry' : 'Entries'}
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'feed' && (
            <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-800 shadow-md">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-indigo-400" />
                    <span>Experience Feed & Cards Repository</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Organize experience, project, education, and about cards.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
                  {/* Category Pills with horizontal scroll on mobile */}
                  <div className="overflow-x-auto max-w-full pb-1 sm:pb-0">
                    <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-lg border border-slate-800 w-max">
                      {(['all', 'experience', 'project', 'education', 'about'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setFeedCategoryFilter(cat)}
                          className={`px-2.5 py-1 text-xs font-semibold rounded capitalize transition ${
                            feedCategoryFilter === cat
                              ? 'bg-indigo-600 text-white'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="file"
                      ref={resumePdfFileInputRef}
                      onChange={handlePdfFileUpload}
                      accept=".pdf,.docx,.txt,.md,.yaml,.yml,.json"
                      className="hidden"
                    />

                    <button
                      onClick={() => resumePdfFileInputRef.current?.click()}
                      className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white border border-purple-500/30 text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow whitespace-nowrap"
                      title="Upload PDF Resume to Auto-Extract YAML via Spark AI"
                    >
                      <Upload className="w-4 h-4 text-purple-200" />
                      <span>Upload Resume PDF</span>
                    </button>

                    <button
                      onClick={() => {
                        setPasteYamlInput('');
                        setPasteYamlError('');
                        setIsPasteYamlOpen(true);
                      }}
                      className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 text-xs font-semibold px-3.5 py-2 rounded-lg transition shadow whitespace-nowrap"
                    >
                      <Clipboard className="w-4 h-4" />
                      <span>Paste YAML</span>
                    </button>

                    <button
                      onClick={() => openCardEditor('master', undefined, undefined, feedCategoryFilter === 'all' ? 'experience' : feedCategoryFilter)}
                      className="flex-1 sm:flex-none flex items-center justify-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3.5 py-2 rounded-lg shadow transition whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Add New Card</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {(parsedProfile?.experiences || [])
                  .filter(exp => feedCategoryFilter === 'all' || (exp.category || 'experience') === feedCategoryFilter)
                  .map((exp) => {
                    const isSelected = selectedExpIds.has(exp.id);
                    const cat = exp.category || 'experience';
                    return (
                      <div
                        key={exp.id}
                        className={`p-5 rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-slate-900 border-indigo-500 shadow-md shadow-indigo-950/40'
                            : 'bg-slate-900/40 border-slate-800 opacity-70 hover:opacity-90'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={() => toggleExpSelection(exp.id)}
                              className={`p-1.5 rounded-md transition ${
                                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                              }`}
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="font-bold text-base text-slate-100">{exp.title}</h3>
                                <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-bold border ${
                                  cat === 'experience' ? 'bg-indigo-950 text-indigo-300 border-indigo-800' :
                                  cat === 'project' ? 'bg-purple-950 text-purple-300 border-purple-800' :
                                  cat === 'education' ? 'bg-amber-950 text-amber-300 border-amber-800' :
                                  'bg-emerald-950 text-emerald-300 border-emerald-800'
                                }`}>
                                  {cat}
                                </span>
                              </div>
                              <span className="text-xs text-indigo-400 font-medium">
                                {exp.company} • {exp.period}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md">
                              {exp.location}
                            </span>
                            <button
                              onClick={() => openCardEditor('master', exp)}
                              className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800 hover:bg-slate-700 rounded-md transition"
                              title="Edit Card"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeExperienceCard(exp.id)}
                              className="p-1.5 text-slate-400 hover:text-rose-400 bg-slate-800 hover:bg-slate-700 rounded-md transition"
                              title="Delete Card"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {exp.skills && exp.skills.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {exp.skills.map((skill, i) => (
                              <span
                                key={i}
                                className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}

                        <ul className="mt-4 space-y-1.5 text-xs text-slate-300 list-disc list-inside">
                          {exp.bullets?.map((b, i) => (
                            <li key={i} className="leading-relaxed">
                              {formatBulletText(b)}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === 'jobs' && (
            <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
                    <Briefcase className="w-5 h-5 text-indigo-400" />
                    <span>Job Tracker Dashboard</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Manage targeted job postings, match scores, and application statuses.
                  </p>
                </div>
              </div>

              <div className="bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-800 space-y-3 sm:space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Job Posting Tailor Engine</span>
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <textarea
                    value={jobDescription}
                    onChange={(e) => setJobDescription(e.target.value)}
                    placeholder="Paste job posting text or requirements here to analyze ATS keywords..."
                    className="w-full sm:flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 h-20 resize-none"
                  />
                  <button
                    onClick={async () => {
                      if (!jobDescription.trim()) return;
                      setIsLlmGenerating(true);
                      try {
                        const analysis = await analyzeJobMatchWithGemini(jobDescription);
                        const newRecord: JobRecord = {
                          id: `job-${Date.now()}`,
                          title: analysis.roleTitle,
                          company: analysis.companyName,
                          dateAdded: new Date().toISOString().split('T')[0],
                          status: 'Draft',
                          description: jobDescription.trim()
                        };
                        setJobsList(prev => [newRecord, ...prev]);
                        setJobDescription('');
                      } catch (e) {
                        console.error('AI Job Matcher error:', e);
                      } finally {
                        setIsLlmGenerating(false);
                      }
                    }}
                    disabled={!jobDescription.trim() || isLlmGenerating}
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs px-4 rounded-lg flex items-center justify-center space-x-2 self-stretch sm:self-end py-3 transition shadow-md whitespace-nowrap shrink-0 w-full sm:w-auto"
                  >
                    {isLlmGenerating ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>Analyzing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Tailor & Track</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg">
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-left text-xs min-w-[750px]">
                    <thead className="bg-slate-850 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-4">Target Role</th>
                        <th className="p-4">Company</th>
                        <th className="p-4">Resume Used</th>
                        <th className="p-4">Description</th>
                        <th className="p-4">Date Added</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">ATS Match Score</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {jobsList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="p-8 text-center text-slate-500 italic">
                            No job tracker entries found. Use the Tailor & Track box above to add job postings.
                          </td>
                        </tr>
                      ) : (
                        jobsList.map((job) => {
                          const linkedRes = resumes.find(r => r.id === job.resumeId);
                          const linkedResTitle = job.resumeTitle || linkedRes?.title;
                          return (
                            <tr key={job.id} className="hover:bg-slate-850/50 transition">
                              <td className="p-4 font-semibold text-slate-100">{job.title}</td>
                              <td className="p-4 text-slate-300">{job.company}</td>
                              <td className="p-4">
                                {linkedResTitle && job.resumeId ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveResumeId(job.resumeId!);
                                      setActiveTab('resumes');
                                    }}
                                    className="text-indigo-400 hover:text-indigo-300 font-semibold text-xs flex items-center space-x-1.5 hover:underline"
                                    title="Open Resume Variant in Manager"
                                  >
                                    <FolderKanban className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span>{linkedResTitle}</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-500 italic">None Linked</span>
                                )}
                              </td>
                              <td className="p-4">
                                {job.description ? (
                                  <button
                                    type="button"
                                    onClick={() => setViewingJobDescription(job)}
                                    className="p-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-indigo-400 hover:text-indigo-300 rounded-lg transition"
                                    title="View Full Job Description"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span className="text-slate-500 italic text-[11px]">No Text</span>
                                )}
                              </td>
                              <td className="p-4 text-slate-400">{job.dateAdded}</td>
                              <td className="p-4">
                                <select
                                  value={job.status}
                                  onChange={(e) => {
                                    const newStatus = e.target.value as JobRecord['status'];
                                    setJobsList(prev => prev.map(j => j.id === job.id ? { ...j, status: newStatus } : j));
                                  }}
                                  className="bg-slate-950 border border-slate-800 text-indigo-300 font-semibold text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:border-indigo-500 cursor-pointer"
                                >
                                  <option value="Draft">Draft</option>
                                  <option value="Applied">Applied</option>
                                  <option value="Interviewing">Interviewing</option>
                                  <option value="Offer">Offer</option>
                                  <option value="Rejected">Rejected</option>
                                </select>
                              </td>
                              <td className="p-4">
                                {analyzingJobId === job.id ? (
                                  <div className="flex items-center space-x-2 text-xs text-indigo-400 font-mono">
                                    <span className="w-3.5 h-3.5 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin"></span>
                                    <span>Analyzing Fit...</span>
                                  </div>
                                ) : typeof job.matchScore === 'number' ? (
                                  <div className="flex items-center space-x-2">
                                    <div className="w-16 sm:w-20 bg-slate-800 h-2 rounded-full overflow-hidden shrink-0">
                                      <div
                                        className={`h-full rounded-full ${
                                          job.matchScore >= 80 ? 'bg-emerald-500' : job.matchScore >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                                        }`}
                                        style={{ width: `${job.matchScore}%` }}
                                      />
                                    </div>
                                    <span className="font-mono text-emerald-400 font-bold">{job.matchScore}%</span>
                                    <button
                                      type="button"
                                      onClick={() => setViewingAtsAnalysisJob(job)}
                                      className="p-1 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-400 hover:text-indigo-300 rounded transition shrink-0 ml-1"
                                      title="Open Advanced ATS & LLM Fit Analysis Report"
                                    >
                                      <FileText className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => runAtsJobMatchAnalysis(job)}
                                    className="flex items-center space-x-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                                    <span>Analyze ATS Match</span>
                                  </button>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <button
                                  onClick={(e) => deleteJob(job.id, e)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded transition"
                                  title="Remove Job Entry"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Card Editor Modal */}
      {editingCard && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-indigo-400" />
                <span>
                  {editingCard.isNew ? 'Create New' : 'Edit'} {editingCard.target === 'master' ? 'Master' : 'Resume Custom'} Card
                </span>
              </h3>
              <button
                onClick={() => setEditingCard(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">Card Type / Category</label>
                {editingCard.target === 'master' && editingCard.isNew ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 sm:gap-2">
                    {(['experience', 'project', 'education', 'about'] as const).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setCardFormCategory(cat)}
                        className={`py-1.5 px-2 text-xs font-medium rounded-lg capitalize border transition ${
                          cardFormCategory === cat
                            ? 'bg-indigo-600 text-white border-indigo-500 font-bold'
                            : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {cat === 'about' ? 'About Me' : cat}
                      </button>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs bg-slate-950 border border-slate-800 text-indigo-300 font-semibold px-3 py-1.5 rounded-lg capitalize inline-block">
                    Section: {cardFormCategory === 'about' ? 'About Me' : cardFormCategory} (Locked)
                  </span>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  {cardFormCategory === 'experience' ? 'Job Title / Role' : cardFormCategory === 'project' ? 'Project Name' : cardFormCategory === 'education' ? 'Degree / Certification' : 'Headline / About Title'}
                </label>
                <input
                  type="text"
                  value={cardFormTitle}
                  onChange={(e) => setCardFormTitle(e.target.value)}
                  placeholder="e.g. Lead Systems Architect"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {cardFormCategory !== 'about' && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        {cardFormCategory === 'education' ? 'Institution / School' : cardFormCategory === 'project' ? 'Organization / Context' : 'Company / Entity'}
                      </label>
                      <input
                        type="text"
                        value={cardFormCompany}
                        onChange={(e) => setCardFormCompany(e.target.value)}
                        placeholder="e.g. UC Berkeley / Personal Project"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Period</label>
                      <input
                        type="text"
                        value={cardFormPeriod}
                        onChange={(e) => setCardFormPeriod(e.target.value)}
                        placeholder="e.g. 2023 - Present"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Location</label>
                      <input
                        type="text"
                        value={cardFormLocation}
                        onChange={(e) => setCardFormLocation(e.target.value)}
                        placeholder="e.g. Remote / SF, CA"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">Attached Skills (comma separated)</label>
                      <input
                        type="text"
                        value={cardFormSkills}
                        onChange={(e) => setCardFormSkills(e.target.value)}
                        placeholder="e.g. React, Python, LLM"
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                </>
              )}

              {cardFormCategory === 'about' ? (
                <div className="space-y-1.5">
                  <label className="block text-[11px] font-medium text-slate-400">About Bio Paragraph (Cohesive Paragraph)</label>
                  <textarea
                    value={cardFormBulletList[0]?.text || ''}
                    onChange={(e) => setCardFormBulletList([{ id: 'b-about-0', text: e.target.value }])}
                    placeholder="Enter cohesive about bio paragraph..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 h-28 resize-none"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-medium text-slate-400">Bullet Achievements</label>
                    <button
                      type="button"
                      onClick={() => setCardFormBulletList([...cardFormBulletList, { id: `b-${Date.now()}-${cardFormBulletList.length}`, text: '' }])}
                      className="flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 border border-indigo-800 px-2 py-0.5 rounded"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Bullet</span>
                    </button>
                  </div>
                  <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                    {cardFormBulletList.map((item, idx) => (
                      <div key={item.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-start gap-2">
                          <textarea
                            value={item.text}
                            onChange={(e) => {
                              const updated = [...cardFormBulletList];
                              updated[idx] = { ...updated[idx], text: e.target.value };
                              setCardFormBulletList(updated);
                            }}
                            placeholder="Enter bullet achievement statement..."
                            className="flex-1 bg-slate-900 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 min-h-[64px] resize-y font-sans leading-relaxed"
                          />
                          {cardFormBulletList.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setCardFormBulletList(cardFormBulletList.filter((_, i) => i !== idx))}
                              className="text-slate-500 hover:text-rose-400 text-xs p-1"
                              title="Delete Bullet"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* AI Enhance Controls */}
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowPromptInput(prev => ({ ...prev, [item.id]: !prev[item.id] }))}
                            className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 font-medium"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>{showPromptInput[item.id] ? 'Hide Custom Prompt' : '+ Add Custom AI Prompt'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAiEnhanceBullet(idx)}
                            disabled={!item.text.trim() || enhancingBulletIndex === idx}
                            className="flex items-center space-x-1.5 text-xs bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-800 px-2.5 py-1 rounded-lg transition disabled:opacity-40"
                            title="Enhance Bullet with Spark AI"
                          >
                            {enhancingBulletIndex === idx ? (
                              <>
                                <span className="w-3 h-3 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin"></span>
                                <span>Enhancing...</span>
                              </>
                            ) : (
                              <>
                                <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                                <span>AI Enhance</span>
                              </>
                            )}
                          </button>
                        </div>

                        {showPromptInput[item.id] && (
                          <input
                            type="text"
                            value={bulletCustomPrompts[item.id] || ''}
                            onChange={(e) => setBulletCustomPrompts({ ...bulletCustomPrompts, [item.id]: e.target.value })}
                            placeholder="Optional custom instruction for AI (e.g. emphasize latency, add metrics, make executive)..."
                            className="w-full bg-slate-900 border border-indigo-500/40 rounded-lg px-3 py-1.5 text-xs text-indigo-200 focus:outline-none placeholder:text-slate-500"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 border-t border-slate-800 pt-3">
              <button
                onClick={() => setEditingCard(null)}
                className="px-3.5 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={saveCardEditor}
                className="px-4 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow transition"
              >
                Save Card
              </button>
            </div>
          </div>
        </div>
      )}



      {/* Paste YAML Import & Prompt Modal */}
      {isPasteYamlOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-2xl rounded-xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Clipboard className="w-5 h-5 text-indigo-400" />
                  <span>Paste Resume YAML</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Import structured YAML directly into your master experience repository.
                </p>
              </div>
              <button
                onClick={() => setIsPasteYamlOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            {/* Prompt Copy Banner */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-indigo-500/30 flex items-center justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-indigo-300 block flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400 inline mr-1" />
                  <span>AI Resume Document & YAML Parser</span>
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Upload a PDF resume file or paste raw YAML code to auto-extract experience, education, skills, and summary.
                </span>
              </div>
              <div className="flex items-center space-x-2 shrink-0">
                <button
                  type="button"
                  onClick={() => resumePdfFileInputRef.current?.click()}
                  className="flex items-center space-x-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition shrink-0"
                  title="Upload PDF Resume File"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload PDF</span>
                </button>
                <button
                  type="button"
                  onClick={copyLlmPromptToClipboard}
                  className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold px-3 py-1.5 rounded-lg transition shrink-0"
                >
                  <Copy className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{copiedPromptSuccess ? '✓ Copied Prompt!' : 'Copy Prompt'}</span>
                </button>
              </div>
            </div>

            {/* YAML Textarea */}
            <div className="space-y-1.5 flex-1 flex flex-col min-h-[220px]">
              <label className="block text-xs font-semibold text-slate-300">Paste YAML Code Below:</label>
              <textarea
                value={pasteYamlInput}
                onChange={(e) => setPasteYamlInput(e.target.value)}
                placeholder="name: John Doe&#10;title: Senior Software Engineer&#10;experiences:&#10;  - id: exp-1&#10;    category: experience&#10;    title: Lead Full Stack Engineer..."
                className="w-full flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-slate-100 font-mono focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>

            {pasteYamlError && (
              <div className="bg-rose-950/80 border border-rose-800 text-rose-300 text-xs p-2.5 rounded-lg">
                ⚠️ {pasteYamlError}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2 justify-between items-center border-t border-slate-800 pt-3">
              <button
                onClick={() => setIsPasteYamlOpen(false)}
                className="w-full sm:w-auto px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg transition"
              >
                Cancel
              </button>
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={handleAiConvertTextToYaml}
                  disabled={!pasteYamlInput.trim() || isLlmGenerating}
                  className="flex items-center justify-center space-x-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow disabled:opacity-40 whitespace-nowrap"
                >
                  {isLlmGenerating ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                      <span>Spark AI Converting...</span>
                    </>
                  ) : (
                    <>
                      <Wand2 className="w-3.5 h-3.5 text-purple-300" />
                      <span>AI Convert Text to YAML</span>
                    </>
                  )}
                </button>
                <button
                  onClick={() => handleImportYaml('merge')}
                  className="px-4 py-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg shadow transition whitespace-nowrap"
                >
                  Import & Merge
                </button>
                <button
                  onClick={() => handleImportYaml('replace')}
                  className="px-4 py-2 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold rounded-lg transition whitespace-nowrap"
                >
                  Import & Replace All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* View Job Description Modal */}
      {viewingJobDescription && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 w-full max-w-xl rounded-xl shadow-2xl p-6 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center space-x-2">
                  <Briefcase className="w-5 h-5 text-indigo-400" />
                  <span>{viewingJobDescription.title}</span>
                </h3>
                <p className="text-xs text-indigo-300 font-medium">
                  {viewingJobDescription.company} • Added {viewingJobDescription.dateAdded}
                </p>
              </div>
              <button
                onClick={() => setViewingJobDescription(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-950 p-4 rounded-xl border border-slate-800">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Job Description & Requirements:</h4>
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-wrap font-sans">
                {viewingJobDescription.description || 'No description text provided for this job.'}
              </p>
            </div>

            <div className="flex justify-end border-t border-slate-800 pt-3">
              <button
                onClick={() => setViewingJobDescription(null)}
                className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Advanced ATS & LLM Fit Analysis Report Modal */}
      {viewingAtsAnalysisJob && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-indigo-500/40 w-full max-w-2xl rounded-2xl shadow-2xl p-5 sm:p-6 space-y-5 max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Advanced ATS & LLM Fit Analysis
                  </h3>
                </div>
                <p className="text-xs text-slate-400">
                  {viewingAtsAnalysisJob.title} • <span className="text-indigo-300">{viewingAtsAnalysisJob.company}</span>
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5 bg-indigo-950/80 border border-indigo-500/40 px-3 py-1.5 rounded-xl">
                  <span className="text-xs text-slate-400 font-medium">ATS Match:</span>
                  <span className="text-sm font-bold font-mono text-emerald-400">{viewingAtsAnalysisJob.matchScore}%</span>
                </div>
                <button
                  onClick={() => setViewingAtsAnalysisJob(null)}
                  className="text-slate-400 hover:text-slate-200 text-xs font-mono p-1"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
              {/* Section 1: Executive LLM Fit Assessment */}
              <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-purple-950/80 border border-indigo-500/30 rounded-xl p-4 space-y-2">
                <h4 className="font-bold text-indigo-300 uppercase tracking-wider flex items-center space-x-1.5 text-[11px]">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>Executive LLM Fit Assessment</span>
                </h4>
                <p className="text-slate-200 leading-relaxed font-sans">
                  {viewingAtsAnalysisJob.atsAnalysisDetails?.fitSummary ||
                    'Candidate demonstrates strong core technical compatibility with the target job requirements.'}
                </p>
              </div>

              {/* Section 2: Keywords Grid (Matched vs Missing) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Matched Keywords */}
                <div className="bg-slate-950 p-4 rounded-xl border border-emerald-500/30 space-y-2">
                  <h5 className="font-semibold text-emerald-400 flex items-center space-x-1.5 text-[11px]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Matched ATS Keywords ({(viewingAtsAnalysisJob.atsAnalysisDetails?.matchedKeywords || []).length})</span>
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {(viewingAtsAnalysisJob.atsAnalysisDetails?.matchedKeywords || []).map((kw, i) => (
                      <span key={i} className="bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2 py-0.5 rounded text-[11px] font-mono flex items-center space-x-1">
                        <span>✓</span>
                        <span>{kw}</span>
                      </span>
                    ))}
                    {(!viewingAtsAnalysisJob.atsAnalysisDetails?.matchedKeywords || viewingAtsAnalysisJob.atsAnalysisDetails.matchedKeywords.length === 0) && (
                      <span className="text-slate-500 italic">None detected</span>
                    )}
                  </div>
                </div>

                {/* Missing Keywords */}
                <div className="bg-slate-950 p-4 rounded-xl border border-amber-500/30 space-y-2">
                  <h5 className="font-semibold text-amber-400 flex items-center space-x-1.5 text-[11px]">
                    <Tag className="w-3.5 h-3.5 text-amber-400" />
                    <span>Missing ATS Keywords ({(viewingAtsAnalysisJob.atsAnalysisDetails?.missingKeywords || []).length})</span>
                  </h5>
                  <div className="flex flex-wrap gap-1.5">
                    {(viewingAtsAnalysisJob.atsAnalysisDetails?.missingKeywords || []).map((kw, i) => (
                      <span key={i} className="bg-amber-950/80 text-amber-300 border border-amber-800/80 px-2 py-0.5 rounded text-[11px] font-mono flex items-center space-x-1">
                        <span>⚠</span>
                        <span>{kw}</span>
                      </span>
                    ))}
                    {(!viewingAtsAnalysisJob.atsAnalysisDetails?.missingKeywords || viewingAtsAnalysisJob.atsAnalysisDetails.missingKeywords.length === 0) && (
                      <span className="text-slate-500 italic text-[11px]">No major missing keywords</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Section 3: Strengths & Gaps */}
              {(viewingAtsAnalysisJob.atsAnalysisDetails?.strengths?.length || 0) > 0 && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="font-semibold text-slate-200 text-[11px] uppercase tracking-wider">Candidate Strengths</h5>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {viewingAtsAnalysisJob.atsAnalysisDetails?.strengths?.map((str, i) => (
                      <li key={i}>{str}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(viewingAtsAnalysisJob.atsAnalysisDetails?.gaps?.length || 0) > 0 && (
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <h5 className="font-semibold text-slate-200 text-[11px] uppercase tracking-wider">Potential Gaps & Recommendations</h5>
                  <ul className="space-y-1 text-slate-300 list-disc list-inside">
                    {viewingAtsAnalysisJob.atsAnalysisDetails?.gaps?.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-between items-center border-t border-slate-800 pt-3">
              <button
                type="button"
                onClick={() => {
                  const targetJob = viewingAtsAnalysisJob;
                  setViewingAtsAnalysisJob(null);
                  runAtsJobMatchAnalysis(targetJob);
                }}
                className="flex items-center space-x-1.5 bg-indigo-950 hover:bg-indigo-900 border border-indigo-800 text-indigo-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
              >
                <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Re-run ATS Analysis</span>
              </button>
              <button
                onClick={() => setViewingAtsAnalysisJob(null)}
                className="px-4 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-lg transition"
              >
                Close Report
              </button>
            </div>
          </div>
        </div>
      )}
      {/* AI Resume Style Creator Modal */}
      {isAiStyleModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-900 border border-indigo-500/50 w-full max-w-4xl rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 animate-in fade-in max-h-[92vh] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Palette className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {editingStyle ? `Refine & Edit Resume Style: ${editingStyle.name}` : 'Create Custom AI Resume Style'}
                </h3>
                <span className="text-[10px] bg-purple-950 text-purple-300 border border-purple-800 px-2 py-0.5 rounded-full font-mono">
                  ✨ Spark AI Powered
                </span>
              </div>
              <button
                onClick={() => setIsAiStyleModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-mono p-1"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 overflow-y-auto pr-1">
              {/* Left Side: Live Style Document Tile Preview Box */}
              <div className="lg:col-span-5 bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col items-center justify-center space-y-3">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider self-start">
                  Live Mini Document Preview
                </span>

                <MiniResumeDocumentTile 
                  style={previewAiStyle || activeStyle}
                  profileName={parsedProfile.name}
                  profileTitle={parsedProfile.title}
                  className="w-52 h-72 shadow-2xl"
                />

                <p className="text-[11px] text-slate-400 text-center italic max-w-xs pt-1">
                  {previewAiStyle ? `Generated: ${previewAiStyle.description}` : 'Enter your design instructions on the right to generate a custom theme.'}
                </p>
              </div>

              {/* Right Side: Prompt Text Area & AI Actions */}
              <div className="lg:col-span-7 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-200 mb-1">
                      {editingStyle ? 'AI Design Refinement Instruction & Prompt:' : 'AI Design Instruction & Aesthetic Prompt:'}
                    </label>
                    <textarea
                      value={aiStylePromptInput}
                      onChange={(e) => setAiStylePromptInput(e.target.value)}
                      placeholder={
                        editingStyle
                          ? `Describe your refinements for "${editingStyle.name}"... (e.g. 'Make the header background dark navy #0f172a, switch font to Space Grotesk, and display skills as pill badges')`
                          : "Describe your ideal resume aesthetic... (e.g., 'Modern Split Left Sidebar: Dark navy left column for Skills & Bio, crisp white right column for Experience & Projects')"
                      }
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500 h-32 resize-none font-sans leading-relaxed"
                    />
                  </div>

                  {/* Curated Suggested Prompts */}
                  <div className="space-y-1.5">
                    <label className="block text-[11px] font-medium text-slate-400">
                      {editingStyle ? 'Quick Refinement Prompts:' : 'Curated Suggested Layout Prompts:'}
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {(editingStyle ? [
                        { label: '🎨 Coral Header Banner', prompt: 'Change header background color to rich coral #e25b4c with white text' },
                        { label: '🏷️ Pill Badge Skills', prompt: 'Display technical skills as rounded pill badges with card background tint' },
                        { label: '📐 Left Brand Stripe', prompt: 'Add a thick crimson left margin brand stripe with editorial serif headings' },
                        { label: '⚡ Dark Navy Split-Right', prompt: 'Use split-right header alignment with dark navy header box #0f172a' }
                      ] : [
                        { label: '🚀 Split Left Sidebar', prompt: 'Modern Split Left Sidebar: Dark navy left column for Skills & Bio, crisp white right column for Experience & Projects' },
                        { label: '💼 Right Column Metrics', prompt: 'Right Column Metrics: Clean slate background with dedicated right sidebar for Technical Skills & Core Competencies' },
                        { label: '🏛️ Harvard Serif Law', prompt: 'Executive Harvard Serif: Classic serif font, double crimson rule dividers, formal right-aligned dates' },
                        { label: '⚡ Cyberpunk Dark Mode', prompt: 'Cyberpunk Dark Mode: Neon purple & cyan glow accents on pitch black background with monospaced font' },
                        { label: '📐 Swiss Brand Margin', prompt: 'Minimalist Swiss Editorial: Bold oversize left headers with a thick crimson brand margin stripe down left edge' },
                        { label: '🎨 Modern Floating Cards', prompt: 'Cards & Floating Grid: Tinted violet background with white floating card blocks and pill badges' }
                      ]).map(item => (
                        <button
                          key={item.label}
                          type="button"
                          onClick={() => setAiStylePromptInput(item.prompt)}
                          className="text-[10px] bg-slate-950 hover:bg-slate-800 border border-slate-800 text-indigo-300 px-2.5 py-1 rounded-lg transition text-left"
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* ATS Format & Resume Data Schema Compatibility Panel */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-indigo-500/30 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-200 flex items-center space-x-1.5 text-[11px] uppercase tracking-wider">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>ATS Format & Data Schema Compatibility Check</span>
                      </span>
                      <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">
                        ✓ 100% Schema Compatible
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-[10px]">
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 space-y-0.5">
                        <span className="text-emerald-400 font-bold">✓ Structural Layout</span>
                        <p className="text-slate-400 truncate font-mono">{(previewAiStyle || activeStyle).theme.layout}</p>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 space-y-0.5">
                        <span className="text-emerald-400 font-bold">✓ ATS Typography</span>
                        <p className="text-slate-400 truncate font-mono">{(previewAiStyle || activeStyle).theme.fontFamily}</p>
                      </div>
                      <div className="bg-slate-900/80 p-2 rounded-lg border border-slate-800 space-y-0.5">
                        <span className="text-emerald-400 font-bold">✓ Data Field Binding</span>
                        <p className="text-slate-400 truncate">Contact, About, Skills, Exp, Edu</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-2 border-t border-slate-800 pt-3">
                  <button
                    type="button"
                    onClick={async () => {
                      if (!aiStylePromptInput.trim()) return;
                      setIsGeneratingAiStyle(true);
                      try {
                        if (editingStyle) {
                          const refined = await refineResumeStyleWithGemini(previewAiStyle || editingStyle, aiStylePromptInput);
                          setPreviewAiStyle(refined);
                        } else {
                          const newStyle = await generateResumeStyleWithGemini(aiStylePromptInput);
                          setPreviewAiStyle(newStyle);
                        }
                      } catch (e) {
                        console.error('Generate/Refine AI Style Error:', e);
                      } finally {
                        setIsGeneratingAiStyle(false);
                      }
                    }}
                    disabled={!aiStylePromptInput.trim() || isGeneratingAiStyle}
                    className="flex-1 flex items-center justify-center space-x-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs py-2.5 rounded-lg shadow-lg transition disabled:opacity-40"
                  >
                    {isGeneratingAiStyle ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        <span>{editingStyle ? 'Spark AI Refining Style...' : 'Spark AI Designing Style...'}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 text-purple-200" />
                        <span>{editingStyle ? 'Refine Style with Spark AI' : 'Generate Resume Style with Spark AI'}</span>
                      </>
                    )}
                  </button>

                  {previewAiStyle && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!previewAiStyle) return;
                        let updatedStyles: ResumeStyle[];
                        const targetStyleId = editingStyle ? editingStyle.id : previewAiStyle.id;
                        if (editingStyle) {
                          updatedStyles = resumeStyles.map(s => s.id === editingStyle.id ? previewAiStyle : s);
                        } else {
                          updatedStyles = [previewAiStyle, ...resumeStyles];
                        }
                        setResumeStyles(updatedStyles);
                        setActiveStyleId(targetStyleId);

                        // Link active style directly to active resume item
                        let updatedResumes = resumes;
                        if (activeResumeId) {
                          updatedResumes = resumes.map(r => r.id === activeResumeId ? { ...r, styleId: targetStyleId } : r);
                          setResumes(updatedResumes);
                        }

                        setIsAiStyleModalOpen(false);

                        // Synchronous Dual-Save to LocalStorage and Firestore Cloud
                        try {
                          localStorage.setItem('rt_styles', JSON.stringify(updatedStyles));
                          localStorage.setItem('rt_active_style_id', targetStyleId);
                          localStorage.setItem('rt_resumes', JSON.stringify(updatedResumes));
                        } catch (e) {}

                        if (currentUser?.uid) {
                          await saveUserDataToFirestore(currentUser.uid, {
                            resumeStyles: updatedStyles,
                            activeStyleId: targetStyleId,
                            resumes: updatedResumes
                          });
                        }
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-5 py-2.5 rounded-lg shadow-lg transition whitespace-nowrap"
                    >
                      {editingStyle ? 'Update & Save Style ✓' : 'Save & Select Style ✓'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
