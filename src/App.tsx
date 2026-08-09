import React, { useState, useMemo, useEffect } from 'react';
import { INITIAL_MASTER_YAML, INITIAL_RESUMES, DEFAULT_JOB_TRACKER } from './mockData';
import { MasterProfile, ExperienceItem, ResumeItem, CardCategory, JobRecord } from './types';
import yaml from 'js-yaml';
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
  Menu,
  X,
  Home,
  Globe,
  User as UserIcon,
  LogOut
} from 'lucide-react';
import { SplashPage } from './components/SplashPage';
import {
  tailorResumeWithGemini,
  convertResumeTextToYamlWithGemini,
  enhanceBulletWithGemini,
  analyzeJobMatchWithGemini
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
  const [viewMode, setViewMode] = useState<'splash' | 'app'>('splash');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'resumes' | 'skills' | 'feed' | 'jobs'>('resumes');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Observe Firebase Auth State
  useEffect(() => {
    if (isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        setCurrentUser(user);
      });
      return () => unsubscribe();
    }
  }, []);

  // LocalStorage Persisted Master Profile State
  const [parsedProfile, setParsedProfile] = useState<MasterProfile>(() => {
    try {
      const saved = localStorage.getItem('rt_profile');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    try {
      return (yaml.load(INITIAL_MASTER_YAML) as MasterProfile) || { experiences: [] };
    } catch (e) {
      return { experiences: [] };
    }
  });

  // LocalStorage Persisted Resumes State
  const [resumes, setResumes] = useState<ResumeItem[]>(() => {
    try {
      const saved = localStorage.getItem('rt_resumes');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return INITIAL_RESUMES;
  });

  const [activeResumeId, setActiveResumeId] = useState<string>(() => {
    return resumes.length > 0 ? resumes[0].id : '';
  });

  // LocalStorage Persisted Job Tracker State
  const [jobsList, setJobsList] = useState<JobRecord[]>(() => {
    try {
      const saved = localStorage.getItem('rt_jobs');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return DEFAULT_JOB_TRACKER;
  });

  // Load data from Firestore when user logs in
  useEffect(() => {
    if (currentUser?.uid) {
      loadUserDataFromFirestore(currentUser.uid).then(cloudData => {
        if (cloudData) {
          if (cloudData.profile) setParsedProfile(cloudData.profile);
          if (cloudData.resumes) setResumes(cloudData.resumes);
          if (cloudData.jobsList) setJobsList(cloudData.jobsList);
        }
      });
    }
  }, [currentUser]);

  // Sync to localStorage & Firestore automatically on state mutations
  useEffect(() => {
    try {
      localStorage.setItem('rt_profile', JSON.stringify(parsedProfile));
    } catch (e) {}
    if (currentUser?.uid) {
      saveUserDataToFirestore(currentUser.uid, { profile: parsedProfile });
    }
  }, [parsedProfile, currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('rt_resumes', JSON.stringify(resumes));
    } catch (e) {}
    if (currentUser?.uid) {
      saveUserDataToFirestore(currentUser.uid, { resumes });
    }
  }, [resumes, currentUser]);

  useEffect(() => {
    try {
      localStorage.setItem('rt_jobs', JSON.stringify(jobsList));
    } catch (e) {}
    if (currentUser?.uid) {
      saveUserDataToFirestore(currentUser.uid, { jobsList });
    }
  }, [jobsList, currentUser]);
  const [jobDescription, setJobDescription] = useState('');

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
    target: 'master' | 'resume';
    resumeId?: string;
    card: ExperienceItem;
    isNew: boolean;
  } | null>(null);

  const [cardFormCategory, setCardFormCategory] = useState<CardCategory>('experience');
  const [cardFormTitle, setCardFormTitle] = useState('');
  const [cardFormCompany, setCardFormCompany] = useState('');
  const [cardFormPeriod, setCardFormPeriod] = useState('');
  const [cardFormLocation, setCardFormLocation] = useState('');
  const [cardFormSkills, setCardFormSkills] = useState('');
  const [cardFormBulletList, setCardFormBulletList] = useState<{ id: string; text: string }[]>([{ id: `b-${Date.now()}-0`, text: '' }]);

  // Paste YAML & AI Enhancer Loading States
  const [isPasteYamlOpen, setIsPasteYamlOpen] = useState(false);
  const [pasteYamlInput, setPasteYamlInput] = useState('');
  const [pasteYamlError, setPasteYamlError] = useState('');
  const [copiedPromptSuccess, setCopiedPromptSuccess] = useState(false);
  const [enhancingBulletIndex, setEnhancingBulletIndex] = useState<number | null>(null);
  const [wizardCustomTailoredCards, setWizardCustomTailoredCards] = useState<ExperienceItem[]>([]);

  const handleAiEnhanceBullet = async (index: number) => {
    const rawText = cardFormBulletList[index]?.text;
    if (!rawText || !rawText.trim()) return;
    setEnhancingBulletIndex(index);
    try {
      const enhanced = await enhanceBulletWithGemini(rawText, cardFormTitle || cardFormCategory);
      setCardFormBulletList(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], text: enhanced };
        return updated;
      });
    } catch (e) {
      console.error('AI Bullet Enhancer error:', e);
    } finally {
      setEnhancingBulletIndex(null);
    }
  };

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

      const selectedMasterIds = new Set(res.selectedCardIds || []);
      if (selectedMasterIds.size === 0) {
        (parsedProfile?.experiences || []).slice(0, 2).forEach(e => selectedMasterIds.add(e.id));
      }

      // 1. Process ONLY Gemini RECOMMENDED experience and project cards
      const recommendedMasterCards = (parsedProfile?.experiences || []).filter(e => {
        const cat = e.category || 'experience';
        return selectedMasterIds.has(e.id) && (cat === 'experience' || cat === 'project');
      });

      recommendedMasterCards.forEach(origCard => {
        const override = (res.tailoredCardOverrides || []).find(o => o.id === origCard.id);
        const bulletsToUse = (override && override.tailoredBullets && override.tailoredBullets.length > 0)
          ? override.tailoredBullets
          : (origCard.bullets || []).map(b => typeof b === 'string' ? b : b.text);

        generatedCustomCards.push({
          ...origCard,
          id: `ai-tailored-${origCard.id}-${Date.now()}`,
          bullets: bulletsToUse,
          isAiTailored: true,
          tailoredForRole: targetRoleName
        });
      });

      // 2. Auto-generate About Card if missing in Master Profile
      const existingAboutCard = (parsedProfile?.experiences || []).find(e => (e.category || 'experience') === 'about');
      if (!existingAboutCard) {
        const aboutParagraph = res.generatedAboutCard?.paragraph?.trim() ||
          `Accomplished specialist targeting ${targetRoleName} opportunities with specialized technical expertise and a proven track record delivering scalable solutions.`;

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
      } else if (selectedMasterIds.has(existingAboutCard.id)) {
        const overrideAbout = (res.tailoredCardOverrides || []).find(o => o.id === existingAboutCard.id);
        if (overrideAbout && overrideAbout.tailoredBullets?.length > 0) {
          generatedCustomCards.push({
            ...existingAboutCard,
            id: `ai-tailored-${existingAboutCard.id}-${Date.now()}`,
            bullets: overrideAbout.tailoredBullets,
            isAiTailored: true,
            tailoredForRole: targetRoleName
          });
        }
      }

      // Store variant-specific AI tailored cards without altering Master Repository
      setWizardCustomTailoredCards(generatedCustomCards);

      const aiCardIds = generatedCustomCards.map(c => c.id);

      // Include education card IDs that were recommended or present
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
    target: 'master' | 'resume',
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
    if (!pasteYamlInput.trim()) {
      setPasteYamlError('Please paste valid YAML content.');
      return;
    }

    try {
      const parsed = yaml.load(pasteYamlInput) as MasterProfile;
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
    } else if (editingCard.target === 'resume' && editingCard.resumeId) {
      if (editingCard.isNew) {
        addCustomResumeCard(editingCard.resumeId, cardPayload);
      } else {
        updateCustomResumeCard(editingCard.resumeId, cardPayload.id, cardPayload);
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

    const newRes: ResumeItem = {
      id: `res-${Date.now()}`,
      title: newResumeTitle,
      targetRole: newResumeRole || stage1CompanyName || 'Role',
      updatedAt: new Date().toISOString().split('T')[0],
      selectedExpIds: Array.from(wizardSelectedExpIds).filter(id => !id.startsWith('ai-tailored-')),
      selectedSkills: finalSkillsList,
      customExperiences: wizardCustomTailoredCards.filter(c => wizardSelectedExpIds.has(c.id))
    };

    setResumes(prev => [newRes, ...prev]);
    setActiveResumeId(newRes.id);

    // If Add Job Posting was expanded / info provided, automatically add new entry to Job Tracker
    if (showStage1Company || stage1CompanyName.trim() || stage1JobPostingText.trim()) {
      const newJob: JobRecord = {
        id: `job-${Date.now()}`,
        company: stage1CompanyName.trim() || 'Target Company',
        title: newResumeRole.trim() || 'Role',
        dateAdded: new Date().toISOString().split('T')[0],
        status: 'Draft',
        matchScore: 92,
        resumeId: newRes.id,
        resumeTitle: newRes.title
      };
      setJobsList(prev => [newJob, ...prev]);
    }

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
  const currentCategoryCards = (parsedProfile?.experiences || []).filter(
    e => (e.category || 'experience') === currentCategory
  );
  const currentCategorySelectedCount = currentCategoryCards.filter(c => wizardSelectedExpIds.has(c.id)).length;
  
  // Validation: For about, experience, project, education allow proceeding if selected or section empty
  const canProceedCurrentCategory = currentCategory === 'skills'
    ? true
    : currentCategoryCards.length === 0 || currentCategorySelectedCount > 0;

  if (viewMode === 'splash' || (!currentUser && isFirebaseConfigured)) {
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
              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs">
                <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-slate-300 font-medium hidden md:inline truncate max-w-[120px]">
                  {currentUser.email || 'User'}
                </span>
                <button
                  onClick={() => isFirebaseConfigured && signOut(auth)}
                  className="text-slate-500 hover:text-rose-400 transition"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Dynamic Tab Body */}
        <div className="flex-1 p-3.5 sm:p-6 overflow-y-auto">
          {activeTab === 'resumes' && (
            <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
              {/* Header Bar with Pop-up Create Button */}
              <div className="bg-slate-900 border border-slate-800 p-4 sm:p-5 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
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
                                    <span>Analyzing & Rewriting Cards with Gemini 2.5 Flash...</span>
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
                              const catCards = (parsedProfile?.experiences || []).filter(e => (e.category || 'experience') === sec);
                              const selectedCount = sec === 'skills' 
                                ? (autoFilledWizardSkills.length + wizardExtraSkills.size)
                                : catCards.filter(c => wizardSelectedExpIds.has(c.id)).length;

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
                                  <span>{sec}</span>
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
                                {masterSkillsBank.map(({ skillName }) => {
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
                                })}
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
                            {currentCategoryCards.length === 0 ? (
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
                                      return (
                                        <div
                                          key={exp.id}
                                          onClick={() => toggleWizardCardSelection(exp.id)}
                                          className={`cursor-pointer p-3.5 rounded-xl border transition-all ${
                                            isSelected
                                              ? 'bg-slate-950 border-indigo-500 shadow-md'
                                              : 'bg-slate-950/40 border-slate-800 opacity-60 hover:opacity-90'
                                          }`}
                                        >
                                          <div className="flex items-start justify-between">
                                            <div className="flex items-center space-x-3">
                                              <div className={`p-1.5 rounded-md transition ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500'}`}>
                                                <CheckCircle2 className="w-4 h-4" />
                                              </div>
                                              <div>
                                                <div className="flex items-center space-x-2 flex-wrap">
                                                  <h4 className="font-bold text-sm text-slate-100">{exp.title}</h4>
                                                  {exp.isAiTailored && (
                                                    <span className="inline-flex items-center space-x-1 bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                      <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                                                      <span>AI Tailored for {exp.tailoredForRole || 'Job Posting'}</span>
                                                    </span>
                                                  )}
                                                </div>
                                                <span className="text-xs text-indigo-400 font-medium">
                                                  {exp.company} • {exp.period}
                                                </span>
                                              </div>
                                            </div>
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
                <div className="lg:col-span-4 space-y-6">
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
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveResumeId(r.id);
                                  setTimeout(() => window.print(), 100);
                                }}
                                className="flex items-center space-x-1 text-[11px] bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-700/60 px-2 py-0.5 rounded transition font-semibold shrink-0"
                                title="Export Resume as PDF"
                              >
                                <Download className="w-3 h-3" />
                                <span>Export PDF</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Live Resume Preview */}
                <div className="lg:col-span-8 space-y-4">
                  <div className="flex items-center justify-between bg-slate-900 px-4 py-2.5 rounded-t-xl border border-slate-800 text-xs text-slate-400">
                    <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
                      <Eye className="w-4 h-4 text-indigo-400" />
                      <span>Live ATS Resume Preview</span>
                    </span>
                    <span className="text-[11px] text-indigo-400 bg-indigo-950 px-2 py-0.5 rounded font-mono border border-indigo-900">
                      {activeResume ? activeResume.title : 'No Resume Selected'}
                    </span>
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
                    <div className="bg-white text-slate-900 p-6 sm:p-8 rounded-b-xl shadow-2xl border border-slate-300 space-y-5 font-sans leading-normal min-h-[600px] overflow-x-auto print-area">
                    {/* Header */}
                    <div className="border-b-2 border-slate-900 pb-3 text-center">
                      <h1 className="text-2xl font-bold tracking-tight uppercase text-slate-900">{parsedProfile.name}</h1>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{activeResume?.targetRole || parsedProfile.title}</p>
                      <p className="text-[11px] text-slate-600 mt-0.5">
                        {parsedProfile.email} • {parsedProfile.phone} • {parsedProfile.location}
                      </p>
                    </div>

                    {/* Summary */}
                    <div>
                      <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 mb-1.5">
                        Professional Summary
                      </h2>
                      <p className="text-[11px] text-slate-800 leading-relaxed">
                        {parsedProfile.summary}
                      </p>
                    </div>

                    {/* Technical Skills & Core Competencies Right Under Summary */}
                    {(() => {
                      const activeSkills = activeResume?.selectedSkills && activeResume.selectedSkills.length > 0
                        ? activeResume.selectedSkills
                        : autoFilledWizardSkills;

                      if (!activeSkills || activeSkills.length === 0) return null;

                      return (
                        <div className="space-y-1.5">
                          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5">
                            Technical Skills & Core Competencies
                          </h2>
                          <p className="text-[11px] text-slate-800 leading-relaxed font-mono">
                            {activeSkills.join(' • ')}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Section Cards Rendered in Order */}
                    {SECTION_ORDER.filter(s => s !== 'skills').map(sec => {
                      const items = (parsedProfile?.experiences || []).filter(e => 
                        (e.category || 'experience') === sec && (activeResume?.selectedExpIds?.includes(e.id) ?? false)
                      );
                      const customItems = (activeResume?.customExperiences || []).filter(c => (c.category || 'experience') === sec);
                      const unTailoredItems = items.filter(m => !customItems.some(c => c.id.includes(m.id)));
                      const totalItems = [...customItems, ...unTailoredItems];
                      if (totalItems.length === 0) return null;

                      return (
                        <div key={sec} className="space-y-2">
                          <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-0.5 capitalize">
                            {sec}
                          </h2>
                          {totalItems.map(exp => (
                            <div key={exp.id} className="space-y-0.5">
                              {sec !== 'about' && (
                                <div className="flex justify-between items-baseline text-[11px]">
                                  <span className="font-bold text-slate-900">{exp.title}</span>
                                  <span className="font-semibold text-slate-700">{exp.company} | {exp.period}</span>
                                </div>
                              )}
                              {sec === 'about' ? (
                                <p className="text-[11px] text-slate-800 leading-relaxed">
                                  {formatBulletText(exp.bullets?.[0] || '')}
                                </p>
                              ) : (
                                <ul className="list-disc list-inside text-[11px] text-slate-800 space-y-0.5">
                                  {exp.bullets?.map((b, i) => (
                                    <li key={i}>{formatBulletText(b)}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })}
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
              <div className="bg-slate-900 p-4 rounded-xl border border-slate-800 space-y-3 shadow-md">
                <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                  <Plus className="w-4 h-4 text-indigo-400" />
                  <span>Add Skill to Master Bank</span>
                </h3>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={newSkillName}
                    onChange={(e) => setNewSkillName(e.target.value)}
                    placeholder="Skill Name (e.g. PyTorch, Kubernetes, GraphQL)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  />

                  <select
                    value={newSkillTargetCardId}
                    onChange={(e) => setNewSkillTargetCardId(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
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
                    className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs px-4 py-2 rounded-lg transition shadow w-full sm:w-auto shrink-0"
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
                          status: 'Applied',
                          matchScore: analysis.matchScore
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
                  <table className="w-full text-left text-xs min-w-[700px]">
                    <thead className="bg-slate-850 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                      <tr>
                        <th className="p-4">Role</th>
                        <th className="p-4">Company</th>
                        <th className="p-4">Resume Used</th>
                        <th className="p-4">Date Added</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">ATS Match Score</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-200">
                      {jobsList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                            No job tracker entries found. Use the Tailor & Track box above to add job postings.
                          </td>
                        </tr>
                      ) : (
                        jobsList.map((job) => {
                          const linkedResTitle = job.resumeTitle || resumes.find(r => r.id === job.resumeId)?.title;
                          return (
                            <tr key={job.id} className="hover:bg-slate-850/50 transition">
                              <td className="p-4 font-semibold text-slate-100">{job.title}</td>
                              <td className="p-4 text-slate-300">{job.company}</td>
                              <td className="p-4">
                                {linkedResTitle ? (
                                  <span className="text-indigo-400 font-medium flex items-center space-x-1.5">
                                    <FolderKanban className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                                    <span>{linkedResTitle}</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-500 italic">None Linked</span>
                                )}
                              </td>
                              <td className="p-4 text-slate-400">{job.dateAdded}</td>
                              <td className="p-4">
                                <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-indigo-950 text-indigo-300 border border-indigo-800">
                                  {job.status}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center space-x-2">
                                  <div className="w-24 bg-slate-800 h-2 rounded-full overflow-hidden">
                                    <div
                                      className="bg-emerald-500 h-full rounded-full"
                                      style={{ width: `${job.matchScore}%` }}
                                    />
                                  </div>
                                  <span className="font-mono text-emerald-400">{job.matchScore}%</span>
                                </div>
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
                      {cat}
                    </button>
                  ))}
                </div>
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
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-medium text-slate-400">Bullet Achievements (Distinct Entities)</label>
                    <button
                      type="button"
                      onClick={() => setCardFormBulletList([...cardFormBulletList, { id: `b-${Date.now()}-${cardFormBulletList.length}`, text: '' }])}
                      className="flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/60 border border-indigo-800 px-2 py-0.5 rounded"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Add Bullet</span>
                    </button>
                  </div>
                  <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                    {cardFormBulletList.map((item, idx) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <span className="text-[10px] text-slate-500 font-mono w-12 truncate">{item.id.slice(-5)}</span>
                        <input
                          type="text"
                          value={item.text}
                          onChange={(e) => {
                            const updated = [...cardFormBulletList];
                            updated[idx] = { ...updated[idx], text: e.target.value };
                            setCardFormBulletList(updated);
                          }}
                          placeholder="Enter bullet achievement text..."
                          className="flex-1 bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleAiEnhanceBullet(idx)}
                          disabled={!item.text.trim() || enhancingBulletIndex === idx}
                          className="flex items-center space-x-1 text-[11px] bg-indigo-950 text-indigo-300 hover:bg-indigo-900 border border-indigo-800 px-2 py-1 rounded transition disabled:opacity-40"
                          title="Enhance Bullet with Gemini AI"
                        >
                          {enhancingBulletIndex === idx ? (
                            <span className="w-3 h-3 border-2 border-indigo-300/30 border-t-indigo-300 rounded-full animate-spin"></span>
                          ) : (
                            <Wand2 className="w-3 h-3 text-indigo-400" />
                          )}
                          <span className="hidden sm:inline">AI Enhance</span>
                        </button>
                        {cardFormBulletList.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setCardFormBulletList(cardFormBulletList.filter((_, i) => i !== idx))}
                            className="text-slate-500 hover:text-rose-400 text-xs p-1"
                          >
                            ✕
                          </button>
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
                  <span>LLM Resume Converter Prompt</span>
                </span>
                <span className="text-[11px] text-slate-400 block">
                  Copy prompt to convert any PDF or text resume into Resume Tailor YAML using ChatGPT or Claude.
                </span>
              </div>
              <button
                type="button"
                onClick={copyLlmPromptToClipboard}
                className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow transition shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedPromptSuccess ? '✓ Copied Prompt!' : 'Copy Prompt'}</span>
              </button>
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
                      <span>Gemini Converting...</span>
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
    </div>
  );
}
