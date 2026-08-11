import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { MasterProfile, ResumeItem, ResumeStyle, ExperienceItem, BulletItem } from '../types';

// Section Order Constants
const SECTION_ORDER = ['about', 'skills', 'experience', 'project', 'education'];

const formatSectionTitle = (sec: string) => {
  if (sec === 'experience') return 'EXPERIENCE';
  if (sec === 'project') return 'PROJECTS';
  if (sec === 'education') return 'EDUCATION';
  if (sec === 'about') return 'ABOUT ME';
  if (sec === 'skills') return 'TECHNICAL SKILLS & CORE COMPETENCIES';
  return sec.toUpperCase();
};

const getBulletString = (bullet: string | BulletItem): string => {
  if (typeof bullet === 'string') return bullet;
  return bullet.text || '';
};

interface Props {
  parsedProfile: MasterProfile;
  activeResume: ResumeItem;
  activeStyle: ResumeStyle;
}

export const ResumeVectorPdfDocument: React.FC<Props> = ({
  parsedProfile,
  activeResume,
  activeStyle
}) => {
  const theme = activeStyle.theme;

  const primaryColor = theme.primaryColor || '#0f172a';
  const secondaryColor = theme.secondaryColor || '#475569';
  const textColor = theme.textColor || '#1e293b';
  const bgColor = theme.bgColor || '#ffffff';
  const dividerColor = theme.dividerColor || '#cbd5e1';

  const styles = StyleSheet.create({
    page: {
      paddingTop: 32,
      paddingBottom: 32,
      paddingLeft: 36,
      paddingRight: 36,
      backgroundColor: bgColor,
      fontFamily: 'Helvetica'
    },
    headerBox: {
      marginBottom: 14,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: dividerColor,
      borderBottomStyle: 'solid'
    },
    candidateName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: primaryColor,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 3
    },
    candidateTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: secondaryColor,
      marginBottom: 4
    },
    contactLine: {
      fontSize: 9.5,
      color: textColor,
      opacity: 0.85
    },
    sectionContainer: {
      marginBottom: 12
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: 'bold',
      color: primaryColor,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingTop: 2,
      paddingBottom: 2
    },
    sectionDivider: {
      width: '100%',
      height: 1.5,
      backgroundColor: dividerColor,
      marginTop: 2,
      marginBottom: 8
    },
    aboutText: {
      fontSize: 9.5,
      color: textColor,
      lineHeight: 1.4
    },
    skillsText: {
      fontSize: 9.5,
      color: textColor,
      lineHeight: 1.4
    },
    entryBlock: {
      marginBottom: 9
    },
    entryTitleLine: {
      fontSize: 10.5,
      fontWeight: 'bold',
      color: textColor,
      marginBottom: 2
    },
    entrySubLine: {
      fontSize: 9.5,
      color: secondaryColor,
      marginBottom: 3
    },
    skillsSubLine: {
      fontSize: 9,
      color: secondaryColor,
      marginBottom: 3,
      opacity: 0.85
    },
    bulletList: {
      marginTop: 2
    },
    bulletItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 2.5
    },
    bulletSymbol: {
      width: 10,
      fontSize: 9,
      color: primaryColor,
      fontWeight: 'bold'
    },
    bulletContent: {
      flex: 1,
      fontSize: 9.5,
      color: textColor,
      lineHeight: 1.35
    }
  });

  // Calculate selected experiences
  const allExperiences: ExperienceItem[] = parsedProfile?.experiences || [];
  const selectedExpIds: string[] = activeResume?.selectedExpIds || [];
  const customExperiences: ExperienceItem[] = activeResume?.customExperiences || [];

  // Filter skills
  const activeSkills: string[] = activeResume?.selectedSkills && activeResume.selectedSkills.length > 0
    ? activeResume.selectedSkills
    : [];

  return (
    <Document title={`${parsedProfile?.name || 'Candidate'} - ${activeResume?.title || 'Resume'}`}>
      <Page size="LETTER" style={styles.page}>
        {/* Header Block */}
        <View style={styles.headerBox}>
          <Text style={styles.candidateName}>{parsedProfile?.name || 'KONSTANTIN VICTORIA'}</Text>
          {parsedProfile?.title && (
            <Text style={styles.candidateTitle}>{parsedProfile.title}</Text>
          )}
          <Text style={styles.contactLine}>
            {[parsedProfile?.email, parsedProfile?.phone, parsedProfile?.location]
              .filter(Boolean)
              .join('  •  ')}
          </Text>
        </View>

        {/* 1. About Me */}
        {(() => {
          const items = allExperiences.filter((e: ExperienceItem) => (e.category || 'experience') === 'about' && selectedExpIds.includes(e.id));
          const custom = customExperiences.filter((c: ExperienceItem) => (c.category || 'experience') === 'about');
          const unTailored = items.filter((m: ExperienceItem) => !custom.some((c: ExperienceItem) => c.id.includes(m.id)));
          const totalAbout = [...custom, ...unTailored];

          if (totalAbout.length === 0) return null;

          return (
            <View style={styles.sectionContainer} wrap={false}>
              <Text style={styles.sectionTitle}>ABOUT ME</Text>
              <View style={styles.sectionDivider} />
              {totalAbout.map((exp: ExperienceItem) => (
                <Text key={exp.id} style={styles.aboutText}>
                  {exp.bullets?.[0] ? getBulletString(exp.bullets[0]) : ''}
                </Text>
              ))}
            </View>
          );
        })()}

        {/* 2. Technical Skills & Core Competencies */}
        {activeSkills.length > 0 && (
          <View style={styles.sectionContainer} wrap={false}>
            <Text style={styles.sectionTitle}>TECHNICAL SKILLS & CORE COMPETENCIES</Text>
            <View style={styles.sectionDivider} />
            <Text style={styles.skillsText}>
              {activeSkills.join('  •  ')}
            </Text>
          </View>
        )}

        {/* 3. Dynamic Sections: EXPERIENCE, PROJECTS, EDUCATION */}
        {SECTION_ORDER.filter(s => s !== 'skills' && s !== 'about').map(sec => {
          const items = allExperiences.filter((e: ExperienceItem) => (e.category || 'experience') === sec && selectedExpIds.includes(e.id));
          const custom = customExperiences.filter((c: ExperienceItem) => (c.category || 'experience') === sec);
          const unTailored = items.filter((m: ExperienceItem) => !custom.some((c: ExperienceItem) => c.id.includes(m.id)));
          const totalItems = [...custom, ...unTailored];

          if (totalItems.length === 0) return null;

          const titleText = formatSectionTitle(sec);

          return (
            <View key={sec} style={styles.sectionContainer}>
              <Text style={styles.sectionTitle} wrap={false}>{titleText}</Text>
              <View style={styles.sectionDivider} wrap={false} />

              {totalItems.map((exp: ExperienceItem) => {
                const hasCompany = exp.company && exp.company.trim() !== 'Personal Project' && exp.company.trim() !== 'N/A';
                const hasLocation = exp.location && exp.location.trim() && exp.location.trim() !== 'Remote' && exp.location.trim() !== 'N/A';
                const hasPeriod = exp.period && exp.period.trim() && exp.period.trim() !== 'N/A';

                const subLineParts: string[] = [];
                if (hasCompany) subLineParts.push(exp.company);
                if (hasLocation) subLineParts.push(exp.location);
                if (hasPeriod) subLineParts.push(exp.period);

                return (
                  <View key={exp.id} style={styles.entryBlock} wrap={false}>
                    {/* Line 1: Job Title / Degree */}
                    <Text style={styles.entryTitleLine}>{exp.title}</Text>

                    {/* Line 2: Company • Location • Dates */}
                    {subLineParts.length > 0 && (
                      <Text style={styles.entrySubLine}>
                        {subLineParts.join('  •  ')}
                      </Text>
                    )}

                    {/* Line 3: Skills */}
                    {exp.skills && exp.skills.length > 0 && (
                      <Text style={styles.skillsSubLine}>
                        Skills: {exp.skills.join(', ')}
                      </Text>
                    )}

                    {/* Line 4+: Bullets */}
                    {exp.bullets && exp.bullets.length > 0 && (
                      <View style={styles.bulletList}>
                        {exp.bullets.map((bullet: string | BulletItem, i: number) => (
                          <View key={i} style={styles.bulletItem}>
                            <Text style={styles.bulletSymbol}>•</Text>
                            <Text style={styles.bulletContent}>{getBulletString(bullet)}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          );
        })}
      </Page>
    </Document>
  );
};
