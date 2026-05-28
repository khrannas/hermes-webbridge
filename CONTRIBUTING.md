# Contributing to hermes-webbridge

Thank you for wanting to contribute! Here's a quick guide.

## How to Contribute

1. **Fork** this repository
2. Create a **feature branch**: `git checkout -b cool-feature`
3. **Commit** your changes: `git commit -m 'feat: add cool feature'`
4. **Push** to the branch: `git push origin cool-feature`
5. Create a **Pull Request** to the `main` branch

## Code Guidelines

- **CommonJS** — use `require()` and `module.exports`, not ES modules
- **Zero dependencies** — don't add external npm packages
- Each command in `src/commands/` must return `{ success, message }`
- Use informative error codes
- Test by running: `node bin/hwb.js help`

## Reporting Issues

- Make sure the issue hasn't been reported before
- Include Node.js version, OS, and error output
- Describe reproduction steps

## Pull Request

- Describe the changes made
- Ensure existing commands are not broken
- Follow existing code style (2-space indentation)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
