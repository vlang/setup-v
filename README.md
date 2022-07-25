<div align="center">
<h1>Setup V</h1>

[vlang.io](https://vlang.io) |
[Contributing](https://github.com/vlang/setup-v/blob/main/CONTRIBUTING.md)

</div>
<div align="center">

[![CI][workflowbadge]][workflowurl]
[![License: MIT][licensebadge]][licenseurl]

</div>

GitHub Action that allows you to setup a V environment.

## Usage

```yaml
- uses: vlang/setup-v@v1.1
  with:
    # Personal access token (PAT) used to fetch the repository. The PAT is configured
    # with the local git config, which enables your scripts to run authenticated git
    # commands. The post-job step removes the PAT.
    #
    # We recommend using a service account with the least permissions necessary.
    # Also when generating a new PAT, select the least scopes necessary.
    #
    # [Learn more about creating and using encrypted secrets](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/creating-and-using-encrypted-secrets)
    #
    # Default: ${{ github.token }}
    token: ''

    # Version to use. It can be the branch, tag or SHA to checkout from the V repository.
    # Examples: 0.2.4, weekly.2022.07
    version: ''

    # File containing the version to use. It can contain the branch, tag or SHA to checkout from the V repository
    # Examples: .v-version
    version-file: ''

    # Set this option if you want the action to check for the latest available version of V.
    # If `stable` is false, it will check for the latest commit from the default branch.
    check-latest: false

    # Set this option if you want the action to use the stable version of V.
    # Will be ignored if `check-latest` is false.
    stable: false

    # Target architecture for V to use. Examples: linux, macos, windows. Will use system architecture by default.
    architecture: ''
```

## Output

This action will output the following variables:

- `bin-path`: Path to the directory that contains the V binary.
- `v-bin-path`: Path to the V binary.
- `version`: Version of V that was used.
- `architecture`: Architecture that was used to install V.

## Contributors

<a href="https://github.com/vlang/setup-v/contributors">
  <img src="https://contrib.rocks/image?repo=vlang/setup-v"/>
</a>

Made with [contributors-img](https://contrib.rocks).

[workflowbadge]: https://github.com/vlang/setup-v/actions/workflows/ci.yml/badge.svg
[licensebadge]: https://img.shields.io/badge/License-MIT-blue.svg
[workflowurl]: https://github.com/vlang/setup-v/actions/workflows/ci.yml
[licenseurl]: https://github.com/vlang/setup-v/blob/main/LICENSE
