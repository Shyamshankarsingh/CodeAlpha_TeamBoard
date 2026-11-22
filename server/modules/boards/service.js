import { getDb } from '../../db/index.js';
import { boardsRepo } from './repo.js';
import { projectsRepo } from '../projects/repo.js';
import { workspacesRepo } from '../workspaces/repo.js';
import { permissions } from '../../lib/permissions.js';
import { between } from '../../lib/position.js';
import { AppError } from '../../lib/errors.js';
import { events } from '../../lib/events.js';
import { logActivity } from '../../lib/activity.js';

export const boardsService = {
  listProjectBoards(userId, projectId) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canViewBoard(membership.role, project.visibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    return boardsRepo.listBoardsForProject(projectId);
  },

  createBoard(userId, projectId, data) {
    const project = projectsRepo.findProjectById(projectId);
    if (!project) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const membership = workspacesRepo.findMembership(project.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Project not found');
    }

    const projectMembership = projectsRepo.findProjectMember(projectId, userId);
    if (!permissions.canManageBoards(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const db = getDb();
    let board;

    const execute = db.transact(() => {
      board = boardsRepo.createBoard({
        projectId,
        name: data.name,
      });

      logActivity(db, {
        workspaceId: project.workspace_id,
        projectId,
        actorId: userId,
        entityType: 'board',
        entityId: board.id,
        action: 'board.created',
        metadata: { name: board.name },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('board.created', {
        workspaceId: project.workspace_id,
        projectId,
        board,
        actorId: userId,
      });
    });

    return board;
  },

  getBoard(userId, boardId) {
    const board = boardsRepo.findBoardById(boardId);
    if (!board) {
      throw new AppError('NOT_FOUND', 404, 'Board not found');
    }

    const membership = workspacesRepo.findMembership(board.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Board not found');
    }

    const projectMembership = projectsRepo.findProjectMember(board.project_id, userId);
    if (!permissions.canViewBoard(membership.role, board.project_visibility, Boolean(projectMembership))) {
      throw new AppError('NOT_FOUND', 404, 'Board not found');
    }

    const columns = boardsRepo.listColumnsForBoard(boardId);
    const canManage = permissions.canManageBoards(membership.role, projectMembership?.role);

    return {
      ...board,
      columns,
      permissions: {
        canManage,
      },
    };
  },

  updateBoard(userId, boardId, updates) {
    const board = boardsRepo.findBoardById(boardId);
    if (!board) {
      throw new AppError('NOT_FOUND', 404, 'Board not found');
    }

    const membership = workspacesRepo.findMembership(board.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Board not found');
    }

    const projectMembership = projectsRepo.findProjectMember(board.project_id, userId);
    if (!permissions.canManageBoards(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const db = getDb();
    let updated;

    const execute = db.transact(() => {
      const changes = boardsRepo.updateBoard(boardId, updates, updates.expectedVersion);
      if (changes === 0) {
        const current = boardsRepo.findBoardById(boardId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Board not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Board was modified by another user. Please reload.'
        );
      }

      updated = boardsRepo.findBoardById(boardId);

      logActivity(db, {
        workspaceId: board.workspace_id,
        projectId: board.project_id,
        actorId: userId,
        entityType: 'board',
        entityId: boardId,
        action: 'board.updated',
        metadata: { name: updated.name },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('board.updated', {
        workspaceId: board.workspace_id,
        projectId: board.project_id,
        board: updated,
        actorId: userId,
      });
    });

    return updated;
  },

  deleteBoard(userId, boardId) {
    const board = boardsRepo.findBoardById(boardId);
    if (!board) {
      throw new AppError('NOT_FOUND', 404, 'Board not found');
    }

    const membership = workspacesRepo.findMembership(board.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Board not found');
    }

    const projectMembership = projectsRepo.findProjectMember(board.project_id, userId);
    if (!permissions.canManageBoards(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // BD-5: Last active board deletion protection
    const activeCount = boardsRepo.countActiveBoardsForProject(board.project_id);
    if (activeCount <= 1) {
      throw new AppError(
        'LAST_BOARD_PROTECTION',
        400,
        'Cannot delete the only board in a project'
      );
    }

    const db = getDb();
    const execute = db.transact(() => {
      boardsRepo.deleteBoard(boardId);

      logActivity(db, {
        workspaceId: board.workspace_id,
        projectId: board.project_id,
        actorId: userId,
        entityType: 'board',
        entityId: boardId,
        action: 'board.deleted',
        metadata: { name: board.name },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('board.deleted', {
        workspaceId: board.workspace_id,
        projectId: board.project_id,
        boardId,
        actorId: userId,
      });
    });

    return { success: true };
  },

  // --- Columns ---

  createColumn(userId, boardId, data) {
    const board = boardsRepo.findBoardById(boardId);
    if (!board) {
      throw new AppError('NOT_FOUND', 404, 'Board not found');
    }

    const membership = workspacesRepo.findMembership(board.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Board not found');
    }

    const projectMembership = projectsRepo.findProjectMember(board.project_id, userId);
    if (!permissions.canManageBoards(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    let position = null;
    if (data.prevPosition !== undefined || data.nextPosition !== undefined) {
      position = between(data.prevPosition, data.nextPosition);
    } else {
      const existing = boardsRepo.listColumnsForBoard(boardId);
      const last = existing.length > 0 ? existing[existing.length - 1].position : null;
      position = between(last, null);
    }

    const db = getDb();
    let column;

    const execute = db.transact(() => {
      column = boardsRepo.createColumn({
        boardId,
        name: data.name,
        category: data.category,
        position,
      });

      logActivity(db, {
        workspaceId: board.workspace_id,
        projectId: board.project_id,
        actorId: userId,
        entityType: 'column',
        entityId: column.id,
        action: 'column.created',
        metadata: { name: column.name, category: column.category },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('column.created', {
        workspaceId: board.workspace_id,
        projectId: board.project_id,
        boardId,
        column,
        actorId: userId,
      });
    });

    return column;
  },

  updateColumn(userId, columnId, updates) {
    const column = boardsRepo.findColumnById(columnId);
    if (!column) {
      throw new AppError('NOT_FOUND', 404, 'Column not found');
    }

    const membership = workspacesRepo.findMembership(column.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Column not found');
    }

    const projectMembership = projectsRepo.findProjectMember(column.project_id, userId);
    if (!permissions.canManageBoards(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const db = getDb();
    let updated;

    const execute = db.transact(() => {
      // BD-4: Category change recomputes completed_at on contained tasks
      if (updates.category && updates.category !== column.category) {
        if (updates.category === 'done') {
          boardsRepo.recomputeTasksCompletedAt(columnId, true);
        } else if (column.category === 'done' && updates.category !== 'done') {
          boardsRepo.recomputeTasksCompletedAt(columnId, false);
        }
      }

      const changes = boardsRepo.updateColumn(columnId, updates, updates.expectedVersion);
      if (changes === 0) {
        const current = boardsRepo.findColumnById(columnId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Column not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Column was modified by another user. Please reload.'
        );
      }

      updated = boardsRepo.findColumnById(columnId);

      logActivity(db, {
        workspaceId: column.workspace_id,
        projectId: column.project_id,
        actorId: userId,
        entityType: 'column',
        entityId: columnId,
        action: 'column.updated',
        metadata: { updates },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('column.updated', {
        workspaceId: column.workspace_id,
        projectId: column.project_id,
        column: updated,
        actorId: userId,
      });
    });

    return updated;
  },

  moveColumn(userId, columnId, { prevPosition = null, nextPosition = null, targetPosition = null, expectedVersion }) {
    const column = boardsRepo.findColumnById(columnId);
    if (!column) {
      throw new AppError('NOT_FOUND', 404, 'Column not found');
    }

    const membership = workspacesRepo.findMembership(column.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Column not found');
    }

    const projectMembership = projectsRepo.findProjectMember(column.project_id, userId);
    if (!permissions.canManageBoards(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    const newPosition = targetPosition || between(prevPosition, nextPosition);

    const db = getDb();
    let updated;

    const execute = db.transact(() => {
      const changes = boardsRepo.moveColumn(columnId, newPosition, expectedVersion);
      if (changes === 0) {
        const current = boardsRepo.findColumnById(columnId);
        if (!current) {
          throw new AppError('NOT_FOUND', 404, 'Column not found');
        }
        throw new AppError(
          'CONCURRENCY_CONFLICT',
          409,
          'Column was modified by another user. Please reload.'
        );
      }

      updated = boardsRepo.findColumnById(columnId);

      logActivity(db, {
        workspaceId: column.workspace_id,
        projectId: column.project_id,
        actorId: userId,
        entityType: 'column',
        entityId: columnId,
        action: 'column.moved',
        metadata: { position: newPosition },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('column.moved', {
        workspaceId: column.workspace_id,
        projectId: column.project_id,
        columnId,
        position: newPosition,
        actorId: userId,
      });
    });

    return updated;
  },

  deleteColumn(userId, columnId, options = {}) {
    const column = boardsRepo.findColumnById(columnId);
    if (!column) {
      throw new AppError('NOT_FOUND', 404, 'Column not found');
    }

    const membership = workspacesRepo.findMembership(column.workspace_id, userId);
    if (!membership) {
      throw new AppError('NOT_FOUND', 404, 'Column not found');
    }

    const projectMembership = projectsRepo.findProjectMember(column.project_id, userId);
    if (!permissions.canManageBoards(membership.role, projectMembership?.role)) {
      throw new AppError('FORBIDDEN', 403, 'Permission denied');
    }

    // BD-2: Non-empty column deletion blocked unless destination column is supplied
    const activeTasks = boardsRepo.countActiveTasksInColumn(columnId);
    if (activeTasks > 0) {
      if (!options || !options.moveToColumnId) {
        throw new AppError(
          'COLUMN_NOT_EMPTY',
          400,
          'Cannot delete column with active tasks without specifying moveToColumnId'
        );
      }

      if (options.moveToColumnId === columnId) {
        throw new AppError(
          'INVALID_DESTINATION_COLUMN',
          400,
          'Destination column cannot be the column being deleted'
        );
      }

      const destCol = boardsRepo.findColumnById(options.moveToColumnId);
      if (!destCol || destCol.board_id !== column.board_id) {
        throw new AppError(
          'INVALID_DESTINATION_COLUMN',
          400,
          'Destination column must belong to the same board'
        );
      }
    }

    const db = getDb();
    const execute = db.transact(() => {
      if (activeTasks > 0) {
        boardsRepo.moveTasksToColumn(columnId, options.moveToColumnId);
      }

      boardsRepo.deleteColumn(columnId);

      logActivity(db, {
        workspaceId: column.workspace_id,
        projectId: column.project_id,
        actorId: userId,
        entityType: 'column',
        entityId: columnId,
        action: 'column.deleted',
        metadata: { name: column.name },
      });
    });

    execute();

    db.afterCommit(() => {
      events.emitEvent('column.deleted', {
        workspaceId: column.workspace_id,
        projectId: column.project_id,
        columnId,
        boardId: column.board_id,
        actorId: userId,
      });
    });

    return { success: true };
  },
};
