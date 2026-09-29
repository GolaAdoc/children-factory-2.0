# Branch Protection

## Prerequisites
- GitHub remote origin
- gh auth status green
- admin rights
- repo plan supports protection

## Settings table

| Setting | Value | Why |
|---|---|---|
| Required PR before merging | on | Approvals 0 for a solo maintainer, raise to 1 when a second human joins. |
| Required status check | docs-verify, strict | branch must be up to date |
| Enforce for admins | on | |
| Force pushes | false | no force pushes |
| Deletions | false | no deletions |
| Linear history | on | |
| Conversation resolution | required | |

## Commands

```powershell
$repo = gh repo view --json nameWithOwner -q .nameWithOwner
$body = @'
{
  "required_status_checks": { "strict": true, "contexts": ["docs-verify", "app-verify"] },
  "enforce_admins": true,
  "required_pull_request_reviews": { "required_approving_review_count": 0, "dismiss_stale_reviews": true },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": true
}
'@
$body | gh api --method PUT "repos/$repo/branches/main/protection" --input -
```

## Verification

```powershell
gh api "repos/$repo/branches/main/protection" --jq '{strict: .required_status_checks.strict, contexts: .required_status_checks.contexts, enforce_admins: .enforce_admins.enabled, approvals: .required_pull_request_reviews.required_approving_review_count, force_push: .allow_force_pushes.enabled, deletions: .allow_deletions.enabled, linear: .required_linear_history.enabled, convo: .required_conversation_resolution.enabled}'
```

## Fallbacks
- If the API returns 403 ("Upgrade to GitHub Pro or make this repository public"), STOP and report. The owner chooses between making the repo public, upgrading the plan, or an equivalent repository ruleset.
- Never mark protection done without the verification output.

> P1A amendment: `app-verify` (workflow `app-ci.yml`) is a second required check. Add it only after it has run once on `main`, using:
> `'{\"strict\":true,\"contexts\":[\"docs-verify\",\"app-verify\"]}' | gh api --method PATCH "repos/$repo/branches/main/protection/required_status_checks" --input -`
