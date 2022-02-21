#!/usr/bin/env node
import { app, onClose as appOnClose, onListening as appOnListening } from './app'
import bootstrapApp from './bootstrapper'

bootstrapApp(app, appOnListening, appOnClose)
