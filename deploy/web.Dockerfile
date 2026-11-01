# NEXUS edge: nginx in front of the app, the API and the model server, plus the LikeC4 site at /c4/.
FROM node:20-alpine AS c4
RUN apk add --no-cache graphviz
WORKDIR /src
COPY architecture/likec4 ./likec4
RUN npx -y likec4@1.60.0 validate likec4 \
 && npx -y likec4@1.60.0 build likec4 -o /out --base /c4/ --use-hash-history --title "NEXUS architecture"

FROM nginxinc/nginx-unprivileged:1.27-alpine
ENV NEXUS_LLM_UPSTREAM=http://host.docker.internal:11434
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=c4 /out /usr/share/nginx/html/c4
COPY VERSION /usr/share/nginx/html/version.txt
EXPOSE 8080
