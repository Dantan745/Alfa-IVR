@ECHO OFF
SETLOCAL
SET DIR=%~dp0
SET APP_HOME=%DIR%
FOR %%i IN ("%APP_HOME%") DO SET APP_HOME=%%~fi
SET APP_BASE_NAME=%~n0
SET DEFAULT_JVM_OPTS="-Xmx64m" "-Xms64m"
IF DEFINED JAVA_HOME (
  SET JAVA_EXE=%JAVA_HOME%\bin\java.exe
) ELSE (
  SET JAVA_EXE=java.exe
)
IF NOT EXIST "%JAVA_EXE%" IF DEFINED JAVA_HOME SET JAVA_EXE=%JAVA_HOME%/bin/java.exe
SET CLASSPATH=%APP_HOME%\gradle\wrapper\gradle-wrapper.jar
"%JAVA_EXE%" %DEFAULT_JVM_OPTS% %JAVA_OPTS% %GRADLE_OPTS% "-Dorg.gradle.appname=%APP_BASE_NAME%" -classpath "%CLASSPATH%" org.gradle.wrapper.GradleWrapperMain %*
