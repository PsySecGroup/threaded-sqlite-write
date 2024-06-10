import { exec as Exec } from 'child_process'
import util from 'util'

export const exec = util.promisify(Exec)
