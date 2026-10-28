'use client';
import * as React from 'react'
import { isBoolean, isArray } from 'lodash';
import { FileListThumbnail, IconFile } from './icons';
import { allowedFileTypes } from './utils';
import { formatUploadFileSize } from '../utils/formatUploadFileSize';
import DropzoneInput from './DropzoneInput';
import InputHiddenStatic from './InputHiddenStatic';
import VariationError from './VariationError';
import VariationLabel from './VariationLabel';
import { useFieldArray } from 'react-hook-form';
import { FaDownload, FaTimes } from 'react-icons/fa';
import { useMerchiFormContext } from '../context/MerchiProductFormProvider';

interface PropsFileListItem {
  file: any;
  disabled?: boolean;
  doDelete?: () => void;
}

function FileListItem({ file, disabled, doDelete }: PropsFileListItem) {
  const fileSizeLabel = formatUploadFileSize(file);

  return (
    <li className='merchi-embed-form_uploaded-file-row'>
      <FileListThumbnail file={file} />
      <div className='merchi-embed-form_uploaded-file-meta'>
        <span className='merchi-embed-form_uploaded-file-name' title={file.name}>
          {file.name}
        </span>
        {fileSizeLabel ? (
          <span className='merchi-embed-form_uploaded-file-size'>{fileSizeLabel}</span>
        ) : null}
      </div>
      {!disabled && (
        <div className='merchi-embed-form_uploaded-file-actions'>
          {file.downloadUrl ? (
            <a
              className='merchi-embed-form_uploaded-file-action'
              href={file.downloadUrl}
              download
              aria-label={`Download ${file.name}`}
            >
              <FaDownload />
            </a>
          ) : null}
          {doDelete ? (
            <button
              type='button'
              className='merchi-embed-form_uploaded-file-action'
              onClick={doDelete}
              aria-label={`Remove ${file.name}`}
            >
              <FaTimes />
            </button>
          ) : null}
        </div>
      )}
    </li>
  );
}

interface VariationFilesListProps {
  disabled?: boolean;
  files: Array<any>;
  onRemove?: (index: number) => void;
}

function VariationFilesList({ disabled, files, onRemove }: VariationFilesListProps) {
  return (
    <ul className='merchi-embed-form_uploaded-files-list'>
      {files.map((f: any, i: number) => (
        <FileListItem
          key={`${f.id ?? i}-publicfile`}
          disabled={disabled}
          doDelete={onRemove ? () => onRemove(i) : undefined}
          file={f}
        />
      ))}
    </ul>
  );
}

function determineBoolean(value: any) {
  return isBoolean(value) ? value : value === 'true' ? true : false;
}

interface VariationFileProps {
  deleteVariationFile: (file: any) => void;
  file: any;
  index: number;
  inputName: string;
}

function VariationFile({
  deleteVariationFile,
  file,
  index,
  inputName,
}: VariationFileProps) {
  const {
    classNameFilePreviewContainer,
    classNameFilePreviewIconWrapper,
  } = useMerchiFormContext();
  return (
    <div
      className={classNameFilePreviewContainer}
      onClick={() => deleteVariationFile(file)}
    >
      <div
        className={classNameFilePreviewIconWrapper}
        onClick={() => deleteVariationFile(file)}
      >
        <FaTimes className='close-icon' />
      </div>
      <IconFile file={file} />
      <InputHiddenStatic
        name={`${inputName}[${index}].id`}
        rules={{ required: true }}
        value={file.id}
      />
    </div>
  );
}

interface Props {
  disabled?: boolean;
  name: string;
  variation: any;
}

function VariationFileInput({ disabled, name, variation }: Props) {
  const { classNameFileUploadContainer, control } = useMerchiFormContext();
  const inputName = `${name}.variationFiles`;
  const { variationField } = variation;
  const { allowFileMultiple, placeholder, required, showFilePreview } =
    variationField;
  const { append, fields, remove } = useFieldArray({
    control,
    keyName: 'fileId',
    name: inputName,
    rules: { required },
  });
  const hasFiles = isArray(fields) && fields.length > 0;
  const _allowFileMultiple = determineBoolean(allowFileMultiple);
  const _showFilePreview = determineBoolean(showFilePreview);
  function handleUploadSuccess(fs: any) {
    if (_allowFileMultiple) {
      append(fs);
    } else {
      if (hasFiles) remove(0);
      append(fs);
    }
  }
  return (
    <div className={classNameFileUploadContainer}>
      <VariationLabel
        name={name}
        variationClassName='merchi-embed-form_input-file'
        variation={variation}
      />
      <div className='merchi-embed-form_file-upload-box'>
        <DropzoneInput
          accept={allowedFileTypes(variationField)}
          disabled={disabled}
          multiple={allowFileMultiple}
          onUploadSuccess={handleUploadSuccess}
          placeholder={placeholder || 'Drag and drop files here, or click to upload'}
        />
        {!_showFilePreview && hasFiles ? (
          <VariationFilesList
            disabled={disabled}
            files={fields}
            onRemove={(index) => remove(index)}
          />
        ) : null}
      </div>
      <VariationError name={name} />
      <div className='uploaded-variation-files'>
        {fields.map((file: any, index: number) =>
          _showFilePreview ? (
            <fieldset className='d-inline-block mr-2' key={file.fileId}>
              <VariationFile
                key={`${name}-file-key-${index}`}
                deleteVariationFile={() => remove(index)}
                file={file}
                index={index}
                inputName={inputName}
              />
            </fieldset>
          ) : (
            <InputHiddenStatic
              key={`${name}-file-key-${index}`}
              name={`${inputName}[${index}].id`}
              rules={{ required: true }}
              value={file.id}
            />
          )
        )}
      </div>
    </div>
  );
}

export default VariationFileInput;
