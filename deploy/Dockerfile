# NEXUS test site: the prototype at /, the LikeC4 architecture at /c4/
# Build:  docker build -f deploy/Dockerfile -t nexus-site .
# Run:    docker run --rm -p 8080:8080 nexus-site   → http://localhost:8080

FROM node:20-alpine AS c4
WORKDIR /src
COPY architecture/likec4 ./likec4
RUN npx -y likec4@1.60.0 validate likec4 \
 && npx -y likec4@1.60.0 build likec4 -o /out --base /c4/ --use-hash-history --title "NEXUS architecture"

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY poc/prototype/index.html /usr/share/nginx/html/index.html
COPY --from=c4 /out /usr/share/nginx/html/c4
COPY VERSION /usr/share/nginx/html/version.txt
EXPOSE 8080
