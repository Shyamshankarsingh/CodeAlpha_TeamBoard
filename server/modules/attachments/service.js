import fs from 'node:fs';
import path from 'node:path';
import { attachmentsRepo } from './repo.js';
import { tasksRepo } from '../tasks/repo.js';
import { projectsRepo } from '../projects/repo.js';
import { workspacesRepo } from '../workspaces/repo.js';
import { permissions } from '../../lib/permissions.js';
import { AppError } from '../../lib/errors.js';
import { isAllowedMimeType, validateMagicBytes } from '../../lib/file-signatures.js';

const UPLOAD_DIR = path.resolve('uploads');

// Ensure directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

export const attachmentsService = {
  async uploadAttachment({ taskId, user, file }) {
    if (!file) {
      throw new AppError('VALIDATION_ERROR', 400, 'File is required');
    }

    const task = tasksRepo.findTaskById(taskId);
    if (!task) {
      // Clean up uploaded file if task does not exist
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const project = projectsRepo.findProjectById(task.projectId);
    if (!project) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const workspaceId = project.workspace_id || project.workspaceId;
    const wsMembership = workspacesRepo.findMembership(workspaceId, user.id);
    if (!wsMembership) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }

    const projMember = projectsRepo.findProjectMember(project.id, user.id);
    const canView = permissions.canViewProject(wsMembership.role, project.visibility, projMember);
    if (!canView) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }

    if (!permissions.canUploadAttachment(wsMembership.role)) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // Validate mime type and magic bytes
    if (!isAllowedMimeType(file.mimetype)) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError('VALIDATION_ERROR', 400, 'Unsupported file type');
    }

    const buffer = fs.readFileSync(file.path);
    if (!validateMagicBytes(buffer, file.mimetype)) {
      if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
      throw new AppError('VALIDATION_ERROR', 400, 'File content signature mismatch');
    }

    const attachment = attachmentsRepo.createAttachment({
      taskId,
      uploaderId: user.id,
      fileName: path.basename(file.originalname),
      fileSize: file.size,
      mimeType: file.mimetype,
      storagePath: file.filename, // Store unique UUID/hashed name
    });

    return attachment;
  },

  listAttachments({ taskId, user }) {
    const task = tasksRepo.findTaskById(taskId);
    if (!task) {
      throw new AppError('NOT_FOUND', 404, 'Task not found');
    }

    const project = projectsRepo.findProjectById(task.projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const workspaceId = project.workspace_id || project.workspaceId;
    const wsMembership = workspacesRepo.findMembership(workspaceId, user.id);
    if (!wsMembership) {
      throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }

    const projMember = projectsRepo.findProjectMember(project.id, user.id);
    const canView = permissions.canViewProject(wsMembership.role, project.visibility, projMember);
    if (!canView) {
      throw new AppError('NOT_FOUND', 404, 'Resource not found');
    }

    return attachmentsRepo.listAttachmentsForTask(taskId);
  },

  getAttachmentForDownload({ attachmentId, user }) {
    const attachment = attachmentsRepo.findAttachmentById(attachmentId);
    if (!attachment) {
      throw new AppError('NOT_FOUND', 404, 'Attachment not found');
    }

    const wsMembership = workspacesRepo.findMembership(attachment.workspaceId, user.id);
    if (!wsMembership) {
      throw new AppError('NOT_FOUND', 404, 'Attachment not found');
    }

    const projMember = projectsRepo.findProjectMember(attachment.projectId, user.id);
    const canView = permissions.canViewProject(wsMembership.role, attachment.projectVisibility, projMember);
    if (!canView) {
      throw new AppError('NOT_FOUND', 404, 'Attachment not found');
    }

    const fullPath = path.resolve(UPLOAD_DIR, attachment.storagePath);
    if (!fs.existsSync(fullPath)) {
      throw new AppError('NOT_FOUND', 404, 'File not found on disk');
    }

    return { attachment, fullPath };
  },

  deleteAttachment({ attachmentId, user }) {
    const attachment = attachmentsRepo.findAttachmentById(attachmentId);
    if (!attachment) {
      throw new AppError('NOT_FOUND', 404, 'Attachment not found');
    }

    const wsMembership = workspacesRepo.findMembership(attachment.workspaceId, user.id);
    if (!wsMembership) {
      throw new AppError('NOT_FOUND', 404, 'Attachment not found');
    }

    const projMember = projectsRepo.findProjectMember(attachment.projectId, user.id);
    const canDelete = permissions.canDeleteAttachment(
      wsMembership.role,
      projMember ? projMember.role : null,
      attachment.uploaderId,
      user.id
    );

    if (!canDelete) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // Delete file from disk
    const fullPath = path.resolve(UPLOAD_DIR, attachment.storagePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
    }

    attachmentsRepo.deleteAttachment(attachmentId);
    return { success: true };
  },
};
