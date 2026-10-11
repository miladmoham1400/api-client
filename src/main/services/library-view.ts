import type Database from 'better-sqlite3'
import { Repositories, RepositoryError } from '../db/repositories'
import { librarySnapshotSchema } from '../../shared/library-view'
export class LibraryService {
  private readonly r: Repositories
  constructor(private readonly db: Database.Database) { this.r=new Repositories(db) }
  private active(w:string) { if(this.r.getSelectedWorkspace()!==w) throw new RepositoryError('NOT_FOUND') }
  list(w:string) {
    this.active(w)
    return this.db.transaction(() => librarySnapshotSchema.parse({workspaceId:w,collections:this.r.listCollections(w),folders:this.r.listFolders(w),requests:this.r.listLibraryRequests(w),treeState:this.r.getTreeState(w)})).deferred()
  }
  setExpansion(w:string,input:unknown) { this.active(w); return this.r.setTreeState(w,input) }
}
