"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.execer = void 0;
exports.cleanup = cleanup;
const core = __importStar(require("@actions/core"));
const cp = __importStar(require("child_process"));
const fs = __importStar(require("fs"));
const installer = __importStar(require("./installer"));
const os = __importStar(require("os"));
const path = __importStar(require("path"));
const tc = __importStar(require("@actions/tool-cache"));
const util = __importStar(require("util"));
const state_helper_1 = require("./state-helper");
exports.execer = util.promisify(cp.exec);
async function run() {
    try {
        //
        // Version is optional.  If supplied, install / use from the tool cache
        // If not supplied then task is still used to setup proxy, auth, etc...
        //
        const version = resolveVersionInput();
        let arch = core.getInput('architecture');
        // if architecture supplied but version is not
        // if we don't throw a warning, the already installed x64 node will be used which is not probably what user meant.
        if (arch && !version) {
            core.warning('`architecture` is provided but `version` is missing. In this configuration, the version/architecture of Node will not be changed. To fix this, provide `architecture` in combination with `version`');
        }
        if (!arch) {
            arch = os.arch();
        }
        const token = core.getInput('token', { required: true });
        const stable = strToBoolean(core.getInput('stable') || 'false');
        const checkLatest = strToBoolean(core.getInput('check-latest') || 'false');
        // Check tool cache before downloading
        if (version) {
            const cachedVersionPath = tc.find('v', version, arch);
            if (cachedVersionPath) {
                core.info(`Found v in cache: ${cachedVersionPath}`);
                core.addPath(cachedVersionPath);
                const vBinPath = path.join(cachedVersionPath, 'v');
                core.setOutput('bin-path', cachedVersionPath);
                core.setOutput('v-bin-path', vBinPath);
                core.setOutput('version', version);
                core.setOutput('architecture', arch);
                return;
            }
        }
        const { installDir, resolvedVersion } = await installer.getVlang({
            authToken: token,
            version,
            checkLatest,
            stable,
            arch
        });
        // Check cache by resolved version (commit SHA) to avoid re-caching
        let cachedPath = tc.find('v', resolvedVersion, arch);
        if (!cachedPath) {
            core.info('Adding v to the cache...');
            cachedPath = await tc.cacheDir(installDir, 'v', resolvedVersion);
            core.info(`Cached v to: ${cachedPath}`);
        }
        else {
            core.info(`Found v in cache: ${cachedPath}`);
        }
        core.addPath(cachedPath);
        const installedVersion = await getVersion(installDir);
        const vBinPath = path.join(cachedPath, 'v');
        core.setOutput('bin-path', cachedPath);
        core.setOutput('v-bin-path', vBinPath);
        core.setOutput('version', installedVersion);
        core.setOutput('architecture', arch);
    }
    catch (error) {
        if (error instanceof Error)
            core.setFailed(error.message);
    }
}
async function cleanup() {
    // @todo: implement
}
function resolveVersionInput() {
    let version = core.getInput('version');
    const versionFileInput = core.getInput('version-file');
    if (version && versionFileInput) {
        core.warning('Both version and version-file inputs are specified, only version will be used');
    }
    if (versionFileInput) {
        const versionFilePath = path.join(process.env.GITHUB_WORKSPACE, versionFileInput);
        if (!fs.existsSync(versionFilePath)) {
            throw new Error(`The specified v version file at: ${versionFilePath} does not exist`);
        }
        version = fs.readFileSync(versionFilePath, 'utf8');
    }
    version = parseVersionFile(version);
    if (versionFileInput) {
        core.info(`Resolved ${versionFileInput} as ${version}`);
    }
    return version;
}
function parseVersionFile(contents) {
    let version = contents.trim();
    if (/^v\d/.test(version)) {
        version = version.substring(1);
    }
    return version;
}
function strToBoolean(str) {
    const falsyValues = ['false', 'no', '0', '', 'undefined', 'null'];
    return !falsyValues.includes(str.toLowerCase());
}
async function getVersion(binPath) {
    const vBinPath = path.join(binPath, 'v');
    const { stdout, stderr } = await (0, exports.execer)(`${vBinPath} version`);
    if (stderr !== '') {
        throw new Error(`Unable to get version from ${vBinPath}`);
    }
    if (stdout !== '') {
        return stdout.trim().split(' ')[1];
    }
    core.warning('Unable to get version from v executable.');
    return '0.0.0';
}
if (state_helper_1.IS_POST) {
    cleanup();
}
else {
    run();
}
