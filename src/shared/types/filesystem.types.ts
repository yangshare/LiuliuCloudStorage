/**
 * 文件系统相关类型定义
 */

/**
 * 文件项接口
 */
export interface IFileItem {
  name: string;
  size: number;
  is_dir: boolean;
  modified: string;
  created: string;
  sign: string;
  thumb: string;
  type: number;
  path?: string;
}

/**
 * 文件节点接口（用于文件树）
 */
export interface IFileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  size?: number;
  modified?: string;
  path: string;
  children?: IFileNode[];
  isExpanded?: boolean;
  hasChildren?: boolean;
}

/**
 * 文件列表响应接口
 */
export interface IFileListResponse {
  code: number;
  message: string;
  data: {
    content: IFileItem[];
    total: number;
    readme: string;
    write: boolean;
    provider: string;
  };
}

/**
 * 面包屑导航项接口
 */
export interface IBreadcrumbItem {
  label: string;
  path: string;
}

/**
 * 视图模式类型
 */
export type IViewMode = 'list' | 'grid';

/**
 * 排序字段类型
 */
export type ISortField = 'name' | 'size' | 'modified';

/**
 * 排序顺序类型
 */
export type ISortOrder = 'asc' | 'desc';

/**
 * 文件选择状态
 */
export interface IFileSelection {
  [path: string]: IFileItem;
}

/**
 * 文件操作类型
 */
export enum FileOperation {
  RENAME = 'rename',
  DELETE = 'delete',
  MOVE = 'move',
  COPY = 'copy'
}
