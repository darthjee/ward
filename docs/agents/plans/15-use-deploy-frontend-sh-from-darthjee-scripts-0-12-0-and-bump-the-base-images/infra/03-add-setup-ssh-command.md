# Add the setup_ssh command
Add a reusable command next to `setup_project` in the existing `commands:` section (L106):

```yaml
setup_ssh:
  steps:
    - run:
        name: Check SSH_KNOWN_HOSTS
        command: |
          if [ -z "${SSH_KNOWN_HOSTS:-}" ]; then
            echo "SSH_KNOWN_HOSTS is not set; refusing to deploy without host-key pinning" >&2
            exit 1
          fi
    - run:
        name: Generate SSH key file
        command: deploy_frontend.sh generate_key_file
```

With `SSH_KNOWN_HOSTS` set, `generate_key_file` writes it out and the script uses `StrictHostKeyChecking=yes`.
The guard exists because the script otherwise falls back silently to `StrictHostKeyChecking=no`.

## Files to Change
- `.circleci/config.yml` — new `setup_ssh` command.
