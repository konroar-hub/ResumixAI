import React from 'react';
import { Document, Page, View, Text, StyleSheet, Font } from '@react-pdf/renderer';
import { MasterProfile, ResumeItem, ResumeStyle, ExperienceItem, BulletItem } from '../types';

// Disable auto-hyphenation (prevents 'orches-tration' line breaks)
Font.registerHyphenationCallback(word => [word]);

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

// Map custom font families to standard PDF fonts
const getPdfFontFamily = (family?: string): string => {
  if (family === 'serif' || family === 'playfair') return 'Times-Roman';
  if (family === 'mono' || family === 'space-grotesk') return 'Courier';
  return 'Helvetica';
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
  const cardBgColor = theme.cardBgColor || '#f8fafc';
  const headerBgColor = theme.headerBgColor || primaryColor;
  const stripeColor = theme.stripeColor || primaryColor;

  const fontFamily = getPdfFontFamily(theme.fontFamily);
  const layout = theme.layout || 'single-column';
  const headerStyle = theme.sectionHeaderStyle || 'uppercase-accent';
  const skillsDisplayStyle = theme.skillsDisplayStyle || 'pill-badges';

  const styles = StyleSheet.create({
    page: {
      paddingTop: layout === 'header-banner' ? 0 : 28,
      paddingBottom: 28,
      paddingLeft: layout === 'brand-margin-stripe' ? 38 : 28,
      paddingRight: 28,
      backgroundColor: bgColor,
      fontFamily: fontFamily
    },
    brandStripe: {
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: 10,
      backgroundColor: stripeColor
    },
    headerBannerBox: {
      backgroundColor: headerBgColor,
      paddingTop: 28,
      paddingBottom: 18,
      paddingLeft: 36,
      paddingRight: 36,
      marginBottom: 16,
      marginLeft: layout === 'brand-margin-stripe' ? -44 : -36,
      marginRight: -36
    },
    headerBannerName: {
      fontSize: 22,
      fontWeight: 'bold',
      color: theme.headerTextColor || '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 4,
      textAlign: theme.headerAlignment === 'center' ? 'center' : 'left'
    },
    headerBannerTitle: {
      fontSize: 11,
      fontWeight: 'bold',
      color: theme.headerTextColor || '#ffffff',
      opacity: 0.9,
      marginBottom: 6,
      textAlign: theme.headerAlignment === 'center' ? 'center' : 'left'
    },
    headerBannerContact: {
      fontSize: 9.5,
      color: theme.headerTextColor || '#ffffff',
      opacity: 0.85,
      textAlign: theme.headerAlignment === 'center' ? 'center' : 'left'
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
      marginBottom: 16
    },
    sectionHeaderWrapper: {
      marginBottom: 8
    },
    sectionTitlePill: {
      fontSize: 11,
      fontWeight: 'bold',
      color: '#ffffff',
      backgroundColor: primaryColor,
      paddingTop: 4,
      paddingBottom: 4,
      paddingLeft: 8,
      paddingRight: 8,
      borderRadius: 4,
      alignSelf: 'flex-start',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 8
    },
    sectionTitleMinimalLeft: {
      fontSize: 12,
      fontWeight: 'bold',
      color: primaryColor,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      borderLeftWidth: 3,
      borderLeftColor: primaryColor,
      borderLeftStyle: 'solid',
      paddingLeft: 6,
      marginBottom: 8
    },
    sectionTitleStandard: {
      fontSize: 12,
      fontWeight: 'bold',
      color: primaryColor,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      paddingTop: 3,
      paddingBottom: 3
    },
    sectionDivider: {
      width: '100%',
      height: 1.5,
      backgroundColor: dividerColor,
      marginTop: 4,
      marginBottom: 10
    },
    aboutText: {
      fontSize: 9.5,
      color: textColor,
      lineHeight: 1.4
    },
    skillsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 4
    },
    skillBadge: {
      backgroundColor: cardBgColor,
      borderWidth: 0.5,
      borderColor: dividerColor,
      borderRadius: 4,
      paddingTop: 2,
      paddingBottom: 2,
      paddingLeft: 6,
      paddingRight: 6,
      marginRight: 4,
      marginBottom: 4,
      fontSize: 9,
      fontWeight: 'bold',
      color: textColor
    },
    skillsText: {
      fontSize: 9.5,
      color: textColor,
      lineHeight: 1.4
    },
    entryCardBlock: {
      backgroundColor: cardBgColor,
      borderWidth: 0.5,
      borderColor: dividerColor,
      borderRadius: 6,
      padding: 10,
      marginBottom: 12
    },
    entryBlock: {
      marginBottom: 12
    },
    entryRowSpaceBetween: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
      marginBottom: 2
    },
    entryTitleLine: {
      fontSize: 10.5,
      fontWeight: 'bold',
      color: textColor
    },
    entryDateLine: {
      fontSize: 9.5,
      fontWeight: 'bold',
      color: secondaryColor
    },
    entrySubLine: {
      fontSize: 9.5,
      color: secondaryColor,
      marginBottom: 3
    },
    skillsSubLine: {
      fontSize: 9,
      color: secondaryColor,
      marginBottom: 4,
      opacity: 0.85
    },
    bulletList: {
      marginTop: 3
    },
    bulletItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 3.5
    },
    bulletSymbol: {
      width: 10,
      fontSize: 9,
      color: primaryColor,
      fontWeight: 'bold'
    },
    bulletContent: {
      flex: 1,
      fontSize: 9.0,
      color: textColor,
      lineHeight: 1.4
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

  const candidateRoleTitle = activeResume?.targetRole || parsedProfile?.title;

  return (
    <Document title={`${parsedProfile?.name || 'Candidate'} - ${activeResume?.title || 'Resume'}`}>
      <Page size="LETTER" style={styles.page}>
        {/* Brand Margin Left Stripe */}
        {layout === 'brand-margin-stripe' && (
          <View style={styles.brandStripe} fixed />
        )}

        {/* Header Block: Header Banner vs Standard Minimal */}
        {layout === 'header-banner' ? (
          <View style={styles.headerBannerBox}>
            <Text style={styles.headerBannerName}>{parsedProfile?.name || 'KONSTANTIN VICTORIA'}</Text>
            {candidateRoleTitle && (
              <Text style={styles.headerBannerTitle}>{candidateRoleTitle}</Text>
            )}
            <Text style={styles.headerBannerContact}>
              {[parsedProfile?.email, parsedProfile?.phone, parsedProfile?.location]
                .filter(Boolean)
                .join('  •  ')}
            </Text>
          </View>
        ) : (
          <View style={styles.headerBox}>
            <Text style={styles.candidateName}>{parsedProfile?.name || 'KONSTANTIN VICTORIA'}</Text>
            {candidateRoleTitle && (
              <Text style={styles.candidateTitle}>{candidateRoleTitle}</Text>
            )}
            <Text style={styles.contactLine}>
              {[parsedProfile?.email, parsedProfile?.phone, parsedProfile?.location]
                .filter(Boolean)
                .join('  •  ')}
            </Text>
          </View>
        )}

        {/* 1. About Me */}
        {(() => {
          const items = allExperiences.filter((e: ExperienceItem) => (e.category || 'experience') === 'about' && selectedExpIds.includes(e.id));
          const custom = customExperiences.filter((c: ExperienceItem) => (c.category || 'experience') === 'about');
          const unTailored = items.filter((m: ExperienceItem) => !custom.some((c: ExperienceItem) => c.id.includes(m.id)));
          const totalAbout = [...custom, ...unTailored];

          if (totalAbout.length === 0) return null;

          return (
            <View style={styles.sectionContainer} wrap={false}>
              {headerStyle === 'pill-badge' || headerStyle === 'filled-badge' ? (
                <Text style={styles.sectionTitlePill}>ABOUT ME</Text>
              ) : headerStyle === 'minimal-left-border' ? (
                <Text style={styles.sectionTitleMinimalLeft}>ABOUT ME</Text>
              ) : (
                <View>
                  <Text style={styles.sectionTitleStandard}>ABOUT ME</Text>
                  <View style={styles.sectionDivider} />
                </View>
              )}
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
            {headerStyle === 'pill-badge' || headerStyle === 'filled-badge' ? (
              <Text style={styles.sectionTitlePill}>TECHNICAL SKILLS & CORE COMPETENCIES</Text>
            ) : headerStyle === 'minimal-left-border' ? (
              <Text style={styles.sectionTitleMinimalLeft}>TECHNICAL SKILLS & CORE COMPETENCIES</Text>
            ) : (
              <View>
                <Text style={styles.sectionTitleStandard}>TECHNICAL SKILLS & CORE COMPETENCIES</Text>
                <View style={styles.sectionDivider} />
              </View>
            )}

            {skillsDisplayStyle === 'pill-badges' ? (
              <View style={styles.skillsContainer}>
                {activeSkills.map((sk: string) => (
                  <Text key={sk} style={styles.skillBadge}>{sk}</Text>
                ))}
              </View>
            ) : (
              <Text style={styles.skillsText}>
                {activeSkills.join('  •  ')}
              </Text>
            )}
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
              {headerStyle === 'pill-badge' || headerStyle === 'filled-badge' ? (
                <Text style={styles.sectionTitlePill} wrap={false}>{titleText}</Text>
              ) : headerStyle === 'minimal-left-border' ? (
                <Text style={styles.sectionTitleMinimalLeft} wrap={false}>{titleText}</Text>
              ) : (
                <View wrap={false}>
                  <Text style={styles.sectionTitleStandard}>{titleText}</Text>
                  <View style={styles.sectionDivider} />
                </View>
              )}

              {totalItems.map((exp: ExperienceItem) => {
                const hasCompany = exp.company && exp.company.trim() !== 'Personal Project' && exp.company.trim() !== 'N/A';
                const hasLocation = exp.location && exp.location.trim() && exp.location.trim() !== 'Remote' && exp.location.trim() !== 'N/A';
                const hasPeriod = exp.period && exp.period.trim() && exp.period.trim() !== 'N/A';

                const subLineParts: string[] = [];
                if (hasCompany) subLineParts.push(exp.company);
                if (hasLocation) subLineParts.push(exp.location);
                if (hasPeriod) subLineParts.push(exp.period);

                const isCardLayout = layout === 'cards-modern';

                return (
                  <View key={exp.id} style={isCardLayout ? styles.entryCardBlock : styles.entryBlock} wrap={false}>
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
