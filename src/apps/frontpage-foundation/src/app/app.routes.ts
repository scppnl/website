import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Clubhuis huren in Bergen op Zoom',
    data: {
      description:
        'Huur het clubhuis in de bossen van Bergen op Zoom, vlak bij de A4 en A58, voor dagactiviteiten: familiedagen, schooldagen, bedrijfsuitjes en workshops. Overnachten is niet mogelijk.',
    },
    loadComponent: () => import('./pages/home/home').then((m) => m.Home),
  },
  {
    path: 'gebouw',
    title: 'Gebouwen & foto’s',
    data: {
      description:
        'Bekijk het grote en het kleine gebouw, de activiteitenruimtes, de keukens en het buitenterrein van ons clubhuis.',
    },
    loadComponent: () => import('./pages/building/building').then((m) => m.Building),
  },
  {
    path: 'ligging',
    title: 'Ligging & omgeving',
    data: {
      description:
        'Ligging in een bosrijke omgeving, vlak bij de A4 en A58: route en bereikbaarheid van het clubhuis aan de Huijbergsebaan 415 in Bergen op Zoom.',
    },
    loadComponent: () => import('./pages/location/location').then((m) => m.Location),
  },
  {
    path: 'tarieven',
    title: 'Tarieven & info',
    data: {
      description:
        'Tarieven, voorwaarden, huisregels en veelgestelde vragen over het huren van ons clubhuis.',
    },
    loadComponent: () => import('./pages/rates/rates').then((m) => m.Rates),
  },
  {
    path: 'reserveren',
    title: 'Reserveren',
    data: {
      description:
        'Vraag online een reservering aan voor het clubhuis van Stichting Clubhuis De Wildert.',
    },
    loadComponent: () => import('./pages/booking/booking').then((m) => m.Booking),
  },
  {
    path: 'contact',
    title: 'Contact',
    data: {
      description:
        'Neem contact op met Stichting Clubhuis De Wildert over de verhuur van het clubhuis.',
    },
    loadComponent: () => import('./pages/contact/contact').then((m) => m.Contact),
  },
  {
    path: '**',
    title: 'Pagina niet gevonden',
    loadComponent: () => import('./pages/not-found/not-found').then((m) => m.NotFound),
  },
];
