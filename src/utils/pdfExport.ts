import React from 'react';
import { pdf } from '@react-pdf/renderer';
import { ResumeVectorPdfDocument } from '../components/ResumeVectorPdfDocument';
import { MasterProfile, ResumeItem, ResumeStyle } from '../types';

export const exportVectorPdfBlob = async (
  parsedProfile: MasterProfile,
  activeResume: ResumeItem,
  activeStyle: ResumeStyle
): Promise<void> => {
  const candidateName = parsedProfile?.name ? parsedProfile.name.trim() : 'Candidate';
  const resumeTitle = activeResume?.title ? activeResume.title.trim() : 'Resume';
  const filename = `${candidateName} - ${resumeTitle}.pdf`;

  // Construct PDF Blob using @react-pdf/renderer
  const doc = React.createElement(ResumeVectorPdfDocument, {
    parsedProfile,
    activeResume,
    activeStyle
  });

  const blobInstance = pdf(doc as any);
  const blob = await blobInstance.toBlob();

  // Create temporary URL and trigger native browser file download
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();

  // Clean up DOM and revoke Blob URL
  setTimeout(() => {
    if (link.parentNode) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(blobUrl);
  }, 1000);
};
