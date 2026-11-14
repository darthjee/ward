import { useEffect, useMemo, useState } from 'react';
import AppController from './components/AppController.js';
import AppHelper from './components/helpers/AppHelper.jsx';
import DisplayLocaleLoader from './utils/locale/DisplayLocaleLoader.js';
import useDisplayLocale from './utils/locale/useDisplayLocale.js';
import { PERSONAL } from './utils/context/ownerContext.js';

const INITIAL_ROUTE = { page: 'home', context: PERSONAL };

/**
 * Root application component: resolves the current hash route and renders the matching
 * page inside the shared header.
 *
 * @returns {React.ReactElement} The rendered application.
 */
export default function App() {
  useDisplayLocale();
  const [route, setRoute] = useState(INITIAL_ROUTE);

  const controller = useMemo(() => new AppController(setRoute), []);

  useEffect(() => {
    DisplayLocaleLoader.start();
  }, []);

  useEffect(() => {
    setRoute(controller.getRoute());
    return controller.buildEffect()();
  }, [controller]);

  return AppHelper.render(route);
}
