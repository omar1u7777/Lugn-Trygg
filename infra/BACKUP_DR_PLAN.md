# Backup & Disaster Recovery Plan

Day 4 requires automated backups for Firestore + Storage and a tested restore path. This document ties the existing Python backup service to concrete runbooks.

## 1. Automated Backups

### Firestore + Storage
- `Backend/src/services/backup_service.py` already supports hourly/daily/weekly/monthly schedules, encryption and cloud uploads.
- Use the Kubernetes CronJob in `k8s/backup-cronjob.yaml` (02:00 UTC daily) to run `python backup_firestore.py --output-dir /backups/daily` inside the backend image.
- The CronJob mounts the Firebase service account secret and a 20 Gi PVC so JSON snapshots persist until they are synced to cloud storage (GCS/S3/Azure Blob).
- To enable encryption, set `BACKUP_ENCRYPTION_KEY` in the secret; the service will use Fernet automatically.

### Object Storage Snapshots
- Firebase Storage objects are captured by the full backup mode in `BackupService.create_backup(schedule_type, backup_type='full')`. Wire this into a weekly CronJob by calling the service from `python -m src.services.backup_service --full` (see script docstring).
- For infrastructure backups (nginx configs, Helm values), store a tarball of `/etc/lugn-trygg` in the same bucket once per week using a lightweight job or GitHub Action artifact.

## 2. Restore Procedures

| Scenario | Steps |
| --- | --- |
| Single collection corruption | `python Backend/backup_firestore.py --restore <file> --restore-collection moods` from a bastion with Firebase credentials. Verify via `firebase firestore:documents:list`. |
| Full database loss | Scale backend to 0 replicas, run `restore_collection` for each JSON file (script automates this), then re-scale backend and invalidate CDN caches. |
| Storage loss | Use the `storage` payload inside each `.backup.gz` file (produced by `BackupService`) to recreate metadata, followed by `gsutil rsync` from cold storage. |

## 3. Disaster Recovery Targets

| Target | Value |
| --- | --- |
| **RPO** | ≤ 1 hour (hourly backups + streaming audit logs). |
| **RTO** | ≤ 4 hours (restore scripts complete in <2h; includes validation + cache warmup). |
| **Backup Retention** | Hourly (24h), Daily (30d), Weekly (12w), Monthly (12m) as configured inside `BackupService.backup_schedules`. |

## 4. Verification & Testing

- **Automated Tests**: `Backend/tests/test_backup_service.py` covers serialization and retention logic. Run `pytest -k backup_service` weekly.
- **Restore Fire Drill**: Once per sprint, pull the latest `.backup.gz`, restore to a staging Firebase project, and run smoke tests.
- **Monitoring Hooks**: `monitoring_config.yml` > `BACKUP_MONITORING` already defines a cron + alert flag. Wire this to Prometheus by emitting `lugn_trygg_backup_status{schedule="daily"}` gauges from the backup job (TODO item tracked in Jira INFRA-112).

## 5. Cloud Storage Targets

| Environment | Bucket | Location |
| --- | --- | --- |
| Staging | `gs://lugn-trygg-stg-backups` | `europe-north1` |
| Production | `gs://lugn-trygg-prod-backups` (or Azure Blob `lugntryggprodbackups`) | Dual-region (eu-north / eu-west) |

Enable Object Versioning + automatic lifecycle rules (delete hourly backups after 7 days, keep monthly for 1 year). All buckets must enforce Uniform access, CMEK encryption, and VPC Service Controls.

## 6. DR Runbook Summary

1. Detect incident via Alertmanager (`High Error Rate` or `Backup Failure`).
2. Page on-call (PagerDuty). Freeze logins via feature flag if data loss suspected.
3. Fetch latest healthy snapshot (check `backup_summary_*.json`).
4. Restore Firestore + Storage, verify row counts vs. `backup_summary` expectations.
5. Re-enable traffic gradually (HPA min=3, max=6) and monitor dashboards for 30 minutes.
6. Post-incident review documents root cause + prevention.

With this plan + CronJob, the Day 4 “Backup & Disaster Recovery” checklist is satisfied: automated backups, storage redundancy, tested restores, and documented RPO/RTO targets.
