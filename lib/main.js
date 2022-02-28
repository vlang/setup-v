"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanup = exports.execer = void 0;
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
function run() {
    return __awaiter(this, void 0, void 0, function* () {
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
            const ref = core.getInput('ref');
            const stable = strToBoolean(core.getInput('stable') || 'false');
            const checkLatest = strToBoolean(core.getInput('check-latest') || 'false');
            const binPath = yield installer.getVlang({
                authToken: token,
                version,
                checkLatest,
                stable,
                ref,
                arch
            });
            core.info('Adding v to the cache...');
            const installedVersion = yield getVersion(binPath);
            const cachedPath = yield tc.cacheDir(binPath, 'v', installedVersion);
            core.info(`Cached v to: ${cachedPath}`);
            core.addPath(cachedPath);
        }
        catch (error) {
            if (error instanceof Error)
                core.setFailed(error.message);
        }
    });
}
function cleanup() {
    return __awaiter(this, void 0, void 0, function* () {
        // @todo: implement
    });
}
exports.cleanup = cleanup;
function resolveVersionInput() {
    let version = core.getInput('version');
    const versionFileInput = core.getInput('version-file');
    if (version && versionFileInput) {
        core.warning('Both version and version-file inputs are specified, only version will be used');
    }
    if (version) {
        return version;
    }
    if (versionFileInput) {
        const versionFilePath = path.join(process.env.GITHUB_WORKSPACE, versionFileInput);
        if (!fs.existsSync(versionFilePath)) {
            throw new Error(`The specified v version file at: ${versionFilePath} does not exist`);
        }
        version = parseVersionFile(fs.readFileSync(versionFilePath, 'utf8'));
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
function getVersion(binPath) {
    return __awaiter(this, void 0, void 0, function* () {
        const vBinPath = path.join(binPath, 'v');
        const { stdout, stderr } = yield (0, exports.execer)(`${vBinPath} version`);
        if (stderr !== '') {
            throw new Error(`Unable to get version from ${vBinPath}`);
        }
        if (stdout !== '') {
            return stdout.trim().split(' ')[1];
        }
        core.warning('Unable to get version from v executable.');
        return '0.0.0';
    });
}
if (state_helper_1.IS_POST) {
    cleanup();
}
else {
    run();
}
