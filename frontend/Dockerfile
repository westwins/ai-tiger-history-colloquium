FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html poster-anim.html coverage-review.html /usr/share/nginx/html/
COPY workbench.css archive-map.css workbench.js research-engine.mjs simulation.mjs archive-map.mjs map-engine.mjs /usr/share/nginx/html/
COPY assets /usr/share/nginx/html/assets
COPY data /usr/share/nginx/html/data
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
