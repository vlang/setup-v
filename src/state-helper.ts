import * as coreCommand from '@actions/core/lib/command'

/**
 * Indicates whether the POST action is running
 */
export const IS_POST = !!process.env['STATE_isPost']

// Publish a variable so that when the POST action runs, it can determine it should run the cleanup logic.
// This is necessary since we don't have a separate entry point.
if (!IS_POST) {
  coreCommand.issueCommand('save-state', {name: 'isPost'}, 'true')
}
