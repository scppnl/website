import { bootstrapApplication, BootstrapContext } from '@angular/platform-browser';
import { mergeApplicationConfig } from '@angular/core';
import { provideServerRendering, withRoutes, RenderMode } from '@angular/ssr';
import { App, appConfig } from './app';
export default (context: BootstrapContext) => bootstrapApplication(App, mergeApplicationConfig(appConfig, {providers: [provideServerRendering(withRoutes([{path: '**', renderMode: RenderMode.Prerender}]))]}), context);
