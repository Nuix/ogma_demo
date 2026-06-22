{{/*
Expand the name of the chart.
*/}}
{{- define "operation-find-cameron.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "operation-find-cameron.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Chart label.
*/}}
{{- define "operation-find-cameron.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "operation-find-cameron.labels" -}}
helm.sh/chart: {{ include "operation-find-cameron.chart" . }}
{{ include "operation-find-cameron.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels.
*/}}
{{- define "operation-find-cameron.selectorLabels" -}}
app.kubernetes.io/name: {{ include "operation-find-cameron.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
Construct DATABASE_URL from the postgresql subchart values.
Format: postgresql://user:password@host:5432/dbname
The host uses the bitnami/postgresql headless service naming convention.
*/}}
{{- define "operation-find-cameron.databaseUrl" -}}
{{- $host := printf "%s-postgresql" .Release.Name }}
{{- $port := "5432" }}
{{- $user := .Values.postgresql.auth.username }}
{{- $pass := .Values.postgresql.auth.password }}
{{- $db   := .Values.postgresql.auth.database }}
{{- printf "postgresql://%s:%s@%s:%s/%s" $user $pass $host $port $db }}
{{- end }}
