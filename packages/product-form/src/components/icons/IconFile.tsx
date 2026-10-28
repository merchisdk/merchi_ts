import * as React from 'react';
import { FaFileAlt, FaFilePdf } from 'react-icons/fa';
import { CgSpinner } from 'react-icons/cg';

function IconContainer({ className, icon: Icon, spin = false }: any) {
  if (!Icon) {
    return null;
  }
  return (
    <span className={className || 'avatar rounded-circle'}>
      <Icon className={spin ? 'animate_spin' : ''} />
    </span>
  );
}

export function isPdf(file: any) {
  return (
    file?.mimetype === 'application/pdf' ||
    file?.mimetype === 'application/x-pdf' ||
    /\.pdf$/i.test(String(file?.name || ''))
  );
}

export function isImageFile(file: any) {
  const mimetype = String(file?.mimetype || '');
  if (mimetype.startsWith('image/')) return true;
  return /\.(jpe?g|gif|png|webp|bmp|svg)$/i.test(String(file?.name || ''));
}

export function isAdobeIllustratorFile(file: any) {
  const mimetype = String(file?.mimetype || '').toLowerCase();
  if (mimetype.includes('illustrator') || mimetype === 'application/postscript') return true;
  return /\.ai$/i.test(String(file?.name || ''));
}

interface FileListThumbnailProps {
  file: any;
  className?: string;
}

export function FileListThumbnail({ file, className }: FileListThumbnailProps) {
  const thumbClass = `merchi-embed-form_uploaded-file-thumb${className ? ` ${className}` : ''}`;

  if (!file?.id) {
    return (
      <span className={`${thumbClass} merchi-embed-form_uploaded-file-thumb--loading`}>
        <CgSpinner className='animate_spin' />
      </span>
    );
  }

  if (isPdf(file)) {
    return (
      <span className={`${thumbClass} merchi-embed-form_uploaded-file-thumb--icon merchi-embed-form_uploaded-file-thumb--pdf`} aria-hidden>
        <FaFilePdf />
      </span>
    );
  }

  if (isAdobeIllustratorFile(file)) {
    return (
      <span className={`${thumbClass} merchi-embed-form_uploaded-file-thumb--ai`} aria-hidden>
        Ai
      </span>
    );
  }

  if (isImageFile(file) && file.viewUrl) {
    return (
      <span
        className={`${thumbClass} merchi-embed-form_uploaded-file-thumb--image`}
        style={{ backgroundImage: `url(${file.viewUrl})` }}
        role='img'
        aria-label={file.name}
      />
    );
  }

  return (
    <span className={`${thumbClass} merchi-embed-form_uploaded-file-thumb--icon`} aria-hidden>
      <FaFileAlt />
    </span>
  );
}

interface FileIconProps {
  file: any;
}

function IconFile({ file }: FileIconProps) {
  const fileUrl = file ? String(file.viewUrl) : '';

  return file.id ? (
    isPdf(file) ? (
      <IconContainer
        className='avatar avatar-md align-middle bg-secondary text-dark shadow'
        icon={FaFilePdf}
      />
    ) : isImageFile(file) && fileUrl ? (
      <div
        className='avatar avatar-bg avatar-md align-middle'
        style={{ backgroundImage: `url(${fileUrl})` }}
      />
    ) : (
      <IconContainer
        className='avatar avatar-md align-middle bg-secondary text-dark shadow'
        icon={FaFileAlt}
      />
    )
  ) : (
    <IconContainer
      className='avatar avatar-md align-middle text-dark shadow'
      icon={CgSpinner}
      spin={true}
    />
  );
}

export default IconFile;
