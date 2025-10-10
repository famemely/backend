# Redis Setup with Docker Compose

## Quick Start

### 1. Start Redis

```bash
cd backend
docker compose up -d
```

This will:

- Pull the Redis 7 Alpine image
- Create a persistent volume for data
- Start Redis on port 6379
- Enable health checks

### 2. Verify Redis is Running

```bash
docker exec famemely-redis redis-cli ping
# Should return: PONG
```

### 3. Start the Backend

```bash
cd backend
pnpm start:dev
```

The backend will now connect to Redis successfully!

## Managing Redis

### View Logs

```bash
docker compose logs -f redis
```

### Stop Redis

```bash
docker compose down
```

### Stop Redis and Remove Data

```bash
docker compose down -v
```

### Restart Redis

```bash
docker compose restart redis
```

### Access Redis CLI

```bash
docker exec -it famemely-redis redis-cli
```

## Redis Configuration

The Docker Compose setup includes:

- **Image**: `redis:7-alpine` (lightweight, production-ready)
- **Port**: 6379 (mapped to host)
- **Persistence**: AOF (Append-Only File) enabled
- **Volume**: `redis-data` for data persistence
- **Health Check**: Runs every 5 seconds
- **Restart Policy**: `unless-stopped`

## Troubleshooting

### Port Already in Use

If port 6379 is already in use, you can change it in `docker-compose.yml`:

```yaml
ports:
  - '6380:6379' # Change host port to 6380
```

Then update `.env`:

```
REDIS_URL=redis://localhost:6380
```

### Connection Refused

1. Check if Redis is running:

   ```bash
   docker ps | grep famemely-redis
   ```

2. Check Redis logs:

   ```bash
   docker compose logs redis
   ```

3. Test connection:
   ```bash
   docker exec famemely-redis redis-cli ping
   ```

### Data Persistence

Data is stored in a Docker volume named `backend_redis-data`. To inspect:

```bash
docker volume inspect backend_redis-data
```

## Environment Variables

Make sure your `.env` file has:

```env
REDIS_URL=redis://localhost:6379
```

## Production Notes

For production, consider:

1. **Password Protection**: Add `--requirepass yourpassword` to the command
2. **Memory Limits**: Add memory limits in docker-compose.yml
3. **Redis Cluster**: For high availability
4. **Monitoring**: Use Redis Insight or similar tools

## Next Steps

Once Redis is running and the backend starts successfully:

1. ✅ Backend connects to Redis
2. ✅ WebSocket gateway initializes
3. ✅ Redis Pub/Sub subscriptions work
4. ✅ Location services are ready to test!
