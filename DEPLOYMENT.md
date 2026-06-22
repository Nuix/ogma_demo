# Deployment Guide

## Kubernetes Deployment to apac.ventures.nuix.com/where_is_cameron

### Prerequisites

1. Access to Nuix Kubernetes cluster
2. `kubectl` configured with appropriate context
3. Docker images built and pushed to registry
4. Database provisioned (PostgreSQL)

### Build and Push Docker Images

```bash
# Build frontend
docker build -t <registry>/witness-board-frontend:latest ./frontend

# Build backend
docker build -t <registry>/witness-board-backend:latest ./backend

# Push to registry
docker push <registry>/witness-board-frontend:latest
docker push <registry>/witness-board-backend:latest
```

### Configure Secrets

Edit `k8s-ingress.yaml` and update the `witness-board-secrets` section with actual values:

```yaml
stringData:
  database-url: "postgresql://witness:ACTUAL_PASSWORD@postgres-host:5432/witness_board"
  aws-access-key-id: "ACTUAL_AWS_KEY"
  aws-secret-access-key: "ACTUAL_AWS_SECRET"
```

### Deploy to Kubernetes

```bash
# Create namespace if it doesn't exist
kubectl create namespace ventures

# Apply the configuration
kubectl apply -f k8s-ingress.yaml

# Check deployment status
kubectl get pods -n ventures
kubectl get ingress -n ventures

# View logs
kubectl logs -n ventures deployment/witness-board-frontend
kubectl logs -n ventures deployment/witness-board-backend
```

### Verify Deployment

1. Visit: https://apac.ventures.nuix.com/where_is_cameron
2. Submit a test witness statement
3. Verify graph updates in real-time via WebSocket

### Subpath Configuration

The application is configured to run at `/where_is_cameron` subpath:

- **Frontend**: Vite's `base` is set via `BASE_PATH` environment variable
- **Backend**: CORS configured for `https://apac.ventures.nuix.com`
- **Ingress**: NGINX rewrite rules handle subpath routing
- **WebSocket**: Socket.io path configured for subpath

### Local Subpath Testing

To test subpath locally before deploying:

```bash
# Set BASE_PATH for frontend
export BASE_PATH="/where_is_cameron/"

# Rebuild frontend
cd frontend
npm run build

# Serve with base path
npm run preview -- --base /where_is_cameron
```

Visit: http://localhost:4173/where_is_cameron

### Database Migration

The backend automatically creates tables on startup. For production:

1. Run `backend/src/init-db.sql` manually on PostgreSQL instance
2. Or let the application create tables on first run
3. Verify with: `kubectl exec -it <backend-pod> -- npm run check-db`

### Monitoring

```bash
# Watch pods
kubectl get pods -n ventures -w

# View ingress
kubectl describe ingress witness-board-ingress -n ventures

# Check backend logs for Claude API calls
kubectl logs -f -n ventures deployment/witness-board-backend | grep -i "claude"

# Check database connectivity
kubectl exec -it -n ventures deployment/witness-board-backend -- env | grep DATABASE_URL
```

### Rollback

```bash
# Delete deployment
kubectl delete -f k8s-ingress.yaml

# Or rollback to previous version
kubectl rollout undo deployment/witness-board-backend -n ventures
kubectl rollout undo deployment/witness-board-frontend -n ventures
```

### Troubleshooting

**Frontend shows 404:**
- Check BASE_PATH is set to `/where_is_cameron` in frontend deployment
- Verify ingress rules are applied: `kubectl get ingress -n ventures -o yaml`

**WebSocket connection fails:**
- Check backend logs for Socket.io initialization
- Verify ingress WebSocket annotations are present
- Test direct backend connection: `kubectl port-forward svc/witness-board-backend 3001:3001 -n ventures`

**API calls fail with CORS errors:**
- Verify CORS_ORIGIN is set to `https://apac.ventures.nuix.com` in backend
- Check browser console for exact CORS error
- Test API directly: `curl https://apac.ventures.nuix.com/where_is_cameron/api/graph`

**Claude API fails:**
- Verify AWS credentials are correctly set in secrets
- Check backend logs: `kubectl logs -n ventures deployment/witness-board-backend`
- Test Bedrock access from pod: `kubectl exec -it <backend-pod> -- curl https://bedrock-runtime.us-east-1.amazonaws.com`

### Production Checklist

- [ ] Docker images built and pushed to registry
- [ ] Secrets updated with real credentials
- [ ] Database provisioned and accessible
- [ ] Namespace created
- [ ] k8s-ingress.yaml applied
- [ ] Pods running (check with `kubectl get pods -n ventures`)
- [ ] Ingress configured (check with `kubectl get ingress -n ventures`)
- [ ] TLS certificate issued (check cert-manager logs)
- [ ] Application accessible at https://apac.ventures.nuix.com/where_is_cameron
- [ ] Test statement submission works
- [ ] WebSocket real-time updates work
- [ ] Graph visualization renders correctly
