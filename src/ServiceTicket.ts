/*
 * Copyright 2019 SpinalCom - www.spinalcom.com
 *
 *  This file is part of SpinalCore.
 *
 *  Please read all of the following terms and conditions
 *  of the Free Software license Agreement ("Agreement")
 *  carefully.
 *
 *  This Agreement is a legally binding contract between
 *  the Licensee (as defined below) and SpinalCom that
 *  sets forth the terms and conditions that govern your
 *  use of the Program. By installing and/or using the
 *  Program, you agree to abide by all the terms and
 *  conditions stated or referenced herein.
 *
 *  If you do not agree to abide by these terms and
 *  conditions, do not demonstrate your acceptance and do
 *  not install or use the Program.
 *  You should have received a copy of the license along
 *  with this file. If not, see
 *  <http://resources.spinalcom.com/licenses.pdf>.
 */

import { SpinalGraphService } from 'spinal-env-viewer-graph-service';

import {
  DEFAULT_CATEGORY_NAME,
  DEFAULT_STEPS,
  PROCESS_HAS_TICKET_RELATION_NAME,
  PROCESS_HAS_TICKET_RELATION_TYPE,
  PROCESS_TYPE,
  SERVICE_ARCHIVE_TYPE,
  SERVICE_LOG_TYPE,
  SERVICE_NAME,
  SERVICE_TYPE,
  SPINAL_TICKET_SERVICE_ARCHIVE_NAME,
  SPINAL_TICKET_SERVICE_ARCHIVE_RELATION_NAME,
  SPINAL_TICKET_SERVICE_ARCHIVE_RELATION_TYPE,
  SPINAL_TICKET_SERVICE_CATEGORY_RELATION_NAME,
  SPINAL_TICKET_SERVICE_CATEGORY_RELATION_TYPE,
  SPINAL_TICKET_SERVICE_CATEGORY_SECTION_RELATION_NAME,
  SPINAL_TICKET_SERVICE_CATEGORY_SECTION_RELATION_TYPE,
  SPINAL_TICKET_SERVICE_CATEGORY_SECTION_TYPE,
  SPINAL_TICKET_SERVICE_CATEGORY_SUB_SECTION_RELATION_NAME,
  SPINAL_TICKET_SERVICE_CATEGORY_SUB_SECTION_RELATION_TYPE,
  SPINAL_TICKET_SERVICE_CATEGORY_TYPE,
  SPINAL_TICKET_SERVICE_LOG_RELATION_NAME,
  SPINAL_TICKET_SERVICE_LOG_RELATION_TYPE,
  SPINAL_TICKET_SERVICE_PROCESS_RELATION_NAME,
  SPINAL_TICKET_SERVICE_PROCESS_RELATION_TYPE,
  SPINAL_TICKET_SERVICE_STEP_RELATION_NAME,
  SPINAL_TICKET_SERVICE_STEP_RELATION_TYPE,
  SPINAL_TICKET_SERVICE_STEP_TYPE,
  SPINAL_TICKET_SERVICE_TARGET_RELATION_NAME,
  SPINAL_TICKET_SERVICE_TARGET_RELATION_TYPE,
  SPINAL_TICKET_SERVICE_TICKET_RELATION_NAME,
  SPINAL_TICKET_SERVICE_TICKET_RELATION_TYPE,
  SPINAL_TICKET_SERVICE_TICKET_SECTION,
  SPINAL_TICKET_SERVICE_TICKET_SECTION_RELATION_NAME,
  SPINAL_TICKET_SERVICE_TICKET_SECTION_RELATION_TYPE,
  SPINAL_TICKET_SERVICE_TICKET_TYPE,
  USER_RELATION_NAME,
  USER_RELATION_TYPE,
} from './Constants';

import {
  CANNOT_ADD_STEP_TO_PROCESS,
  CANNOT_CREATE_CONTEXT_INTERNAL_ERROR,
  CANNOT_CREATE_PROCESS_INTERNAL_ERROR,
  DEFAULT_SENTENCE_SECTION_ALREADY_EXIST,
  PROCESS_ID_DOES_NOT_EXIST,
  PROCESS_NAME_ALREADY_USED,
  STEP_ID_DOES_NOT_EXIST,
  TICKET_ID_DOES_NOT_EXIST,
  TICKET_SECTION_ALREADY_EXIST,
} from './Errors';

import { TicketInterface } from 'spinal-models-ticket/declarations/SpinalTicket';
import { SpinalProcess } from 'spinal-models-ticket/declarations/SpinalProcess';
import { SpinalServiceUser } from 'spinal-service-user';
import { SpinalLogTicket } from 'spinal-models-ticket/declarations/SpinalLogTicket';

export class ServiceTicket {

  public contextId: string;
  private context: any;
  private processNames: Set<string>;
  private processes: Set<string>;
  public initialized: boolean;
  private steps: Set<string>;
  private tickets: Set<string>;
  private processByStep: Map<string, string>;
  private stepByProcess: Map<string, string[]>;
  private ticketByStep: Map<string, string[]>;

  constructor() {
    this.initialized = false;
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  public init() {
    this.context = SpinalGraphService.getContext(SERVICE_NAME);
    if (typeof this.context !== 'undefined') {
      this.initVar(this.context.info.id.get())
        .catch((e) => {
          throw  new Error(e);
        });
    } else {
      this.createContext()
        .catch((e) => {
          throw new Error(e);
        });
    }
  }

  public addCategory(processId: string, sentence: string): Promise<boolean | string> {
    if (!this.processes.has(processId)) {
      return Promise.reject('${PROCESS_ID_DOES_NOT_EXIST}: ${processId}');
    }
    return SpinalGraphService
      .getChildren(processId,
        [SPINAL_TICKET_SERVICE_CATEGORY_SECTION_RELATION_NAME])
      .then((children) => {
        if (children.length > 0) {
          const sectionId: string = children[0].id.get();
          const sentenceId: string = SpinalGraphService.createNode({
            name: sentence,
            type: SPINAL_TICKET_SERVICE_CATEGORY_TYPE,
          });

          return SpinalGraphService
            .addChildInContext(
              sectionId, sentenceId, this.contextId,
              SPINAL_TICKET_SERVICE_CATEGORY_RELATION_NAME,
              SPINAL_TICKET_SERVICE_CATEGORY_RELATION_TYPE)
            .then(() => {
              return Promise.resolve(true);
            });
        }

        return this.addSentenceSection(processId).then((bool) => {
          if (bool) {
            return this.addCategory(processId, sentence);
          }
        });

      });
  }

  public addSubCategory(categoryId: string, sentence: string): Promise<boolean | string> {
    const sentenceId: string = SpinalGraphService.createNode({
      name: sentence,
      type: SPINAL_TICKET_SERVICE_CATEGORY_TYPE,
    });

    return SpinalGraphService
      .addChildInContext(
        categoryId, sentenceId, this.contextId,
        SPINAL_TICKET_SERVICE_CATEGORY_SUB_SECTION_RELATION_NAME,
        SPINAL_TICKET_SERVICE_CATEGORY_SUB_SECTION_RELATION_TYPE)
      .then(() => {
        return Promise.resolve(true);
      });
  }

  public addStep(stepId: string, processId: string): Promise<boolean | Error> {
    if (!this.processes.has(processId)) {
      return Promise.reject(Error(PROCESS_ID_DOES_NOT_EXIST));
    }
    if (!this.steps.has(stepId)) {
      return Promise.reject(Error(STEP_ID_DOES_NOT_EXIST));
    }

    return SpinalGraphService
      .addChildInContext(processId, stepId, this.contextId,
                         SPINAL_TICKET_SERVICE_STEP_RELATION_NAME,
                         SPINAL_TICKET_SERVICE_STEP_RELATION_TYPE)
      .then(() => {
        this.addStepToProcess(stepId, processId);

        return Promise.resolve(true);
      })
      .catch((e) => {
        return Promise.reject(Error(CANNOT_ADD_STEP_TO_PROCESS + e));
      });
  }

  public addLocationToTicket(ticketId: string, bimId: string) {
    return SpinalGraphService.addChild(
      ticketId,
      bimId,
      SPINAL_TICKET_SERVICE_TARGET_RELATION_NAME,
      SPINAL_TICKET_SERVICE_TARGET_RELATION_TYPE
    );
  }

  public async addTicketToProcessWithUser(ticketId: string,
                                          processId: string,
                                          userId: string)
    : Promise<boolean | Error> {

    const process = SpinalGraphService.getNode(processId);
    try {
      const addedToUser = await SpinalServiceUser
        .addNode(userId, ticketId, USER_RELATION_NAME, USER_RELATION_TYPE);
      if (addedToUser) {
        return this.addTicket(ticketId, process.defaultStepId.get());
      }
      return Promise.resolve(Error('CANNOT_ADD_TO_USER'));
    } catch (e) {
      return Promise.resolve(Error(e.message));
    }

  }

  public addTicketToProcess(ticketId: string, processId: string): Promise<boolean | Error> {
    const process = SpinalGraphService.getNode(processId);
    return this.addTicket(ticketId, process.defaultStepId.get());
  }

  public addTicket(ticketId: string, stepId: string): Promise<boolean | Error> {

    if (!this.steps.has(stepId)) {
      return Promise.reject(Error(STEP_ID_DOES_NOT_EXIST));
    }
    if (!this.tickets.has(ticketId)) {
      return Promise.reject(Error(TICKET_ID_DOES_NOT_EXIST));
    }

    return SpinalGraphService
      .addChildInContext(stepId, ticketId,
                         this.contextId, SPINAL_TICKET_SERVICE_TICKET_RELATION_NAME,
                         SPINAL_TICKET_SERVICE_TICKET_RELATION_TYPE)
      .then(() => {
        this.addTicketToStep(ticketId, stepId);
        return this.addTicketToProcessTicketSection(stepId, ticketId).then(() => {
          return Promise.resolve(true);
        });
      })
      .catch((e) => {
        return Promise.reject(Error(CANNOT_ADD_STEP_TO_PROCESS + e));
      });
  }

  public createProcess(process: SpinalProcess): Promise<string | Error> {
    if (this.processNames.has(process.name)) {
      return Promise.reject(Error(PROCESS_NAME_ALREADY_USED));
    }

    process.type = PROCESS_TYPE;

    const processId = SpinalGraphService.createNode(process);

    return SpinalGraphService.addChildInContext(
      this.contextId,
      processId,
      this.contextId,
      SPINAL_TICKET_SERVICE_PROCESS_RELATION_NAME,
      SPINAL_TICKET_SERVICE_PROCESS_RELATION_TYPE,
    ).then(() => {
      this.processNames.add(name);
      this.processes.add(processId);
      return this.initProcess(processId).then(() => {
        return Promise.resolve(processId);
      });
    })
      .catch((e) => {
        console.error(e);
        return Promise.reject(Error(CANNOT_CREATE_PROCESS_INTERNAL_ERROR));
      });
  }

  public createStep(name: string, color: string): string {
    const stepId = SpinalGraphService
      .createNode(
        {
          name,
          color,
          type: SPINAL_TICKET_SERVICE_STEP_TYPE,
        });
    this.steps.add(stepId);
    return stepId;
  }

  public createTicket(info: TicketInterface): string {
    info.type = SPINAL_TICKET_SERVICE_TICKET_TYPE;
    const ticketId = SpinalGraphService.createNode(
      info,
      info);
    this.tickets.add(ticketId);
    return ticketId;
  }

  public createLog(info: SpinalLogTicket): string {
    const ticketId = SpinalGraphService.createNode(
      {
        name: info.ticketId,
        type: SERVICE_LOG_TYPE,
      },
      info);
    return ticketId;
  }

  public getTicketForUser(userId: string): Promise<any> {

    return SpinalGraphService.getChildren(userId, [USER_RELATION_NAME]);
  }

  public createArchives(): Promise<boolean | Error> {
    const archives = SpinalGraphService
      .getChildren(this.contextId, [SPINAL_TICKET_SERVICE_ARCHIVE_RELATION_NAME]);
    if (archives.leght > 0) {
      return;
    }
    const archiveId = SpinalGraphService.createNode(
      {
        name: SPINAL_TICKET_SERVICE_ARCHIVE_NAME,
        type: SERVICE_ARCHIVE_TYPE,
      });

    return SpinalGraphService
      .addChild(this.contextId,
                archiveId,
                SPINAL_TICKET_SERVICE_ARCHIVE_RELATION_NAME,
                SPINAL_TICKET_SERVICE_ARCHIVE_RELATION_TYPE,
      )
      .then((res) => {
        return Promise.resolve(true);
      })
      .catch((e) => {
        return Promise.reject(Error(e));
      });
  }

  public getContext(): Promise<string> {
    if (typeof this.contextId !== 'undefined') {
      return Promise.resolve(this.contextId);
    }

    return this.createContext()
      .then(() => {
        return Promise.resolve(this.contextId);
      });
  }

  public getAllProcess(): Set<string> {
    return this.processes;
  }

  public getAllTickets(): Set<string> {
    return this.tickets;
  }

  public getStepsFromProcess(processId: string): string[] {
    return this.stepByProcess.get(processId);
  }

  public getTicketsFromStep(stepId: string): string[] {
    return this.ticketByStep.get(stepId);
  }

  public async getCategoriesFromProcess(processId: string): Promise<{ id: string, children: string[] }[]> {
    if (!this.processes.has(processId)) {
      return Promise.reject('${PROCESS_ID_DOES_NOT_EXIST}: ${processId}');
    }

    return SpinalGraphService
      .getChildren(processId,
        [SPINAL_TICKET_SERVICE_CATEGORY_SECTION_RELATION_NAME])
      .then((children) => {
        if (children.length > 0) {
          const sectionId: string = children[0].id.get();
          return SpinalGraphService.getChildren(sectionId, [])
            .then(
              children => {
                return this.getCategories(children[0].id.get(), []);

              }
            )
        }

        return {parent: processId};

      });
  }

  public moveTicket(ticketId: string, stepFromId: string, stepToId: string): void {
    const step = SpinalGraphService.getNode(stepToId);
    SpinalGraphService.modifyNode(ticketId, {stepId: stepToId, color: step['color']});
    SpinalGraphService
      .addChild(
        ticketId,
        this.createLog({
          ticketId,
          steps: [stepFromId, stepToId],
          date: Date.now(),
        }),
        SPINAL_TICKET_SERVICE_LOG_RELATION_NAME,
        SPINAL_TICKET_SERVICE_LOG_RELATION_TYPE,
      );
    SpinalGraphService
      .moveChild(
        stepFromId, stepToId, ticketId,
        SPINAL_TICKET_SERVICE_TICKET_RELATION_NAME,
        SPINAL_TICKET_SERVICE_TICKET_RELATION_TYPE);

  }

  private async getCategories(id: string, res: { id: string, children: string[] }[]): Promise<{ id: string, children: string[] }[]> {

    const node = SpinalGraphService.getNode(id);
    const category = {
      id,
      name: node.name.get(),
      children: [],
      value: node.name.get()
    };

    if (
      (typeof node === 'undefined')
      || (node.hasOwnProperty('childrenIds') && node.childrenIds.length === 0)
    ) {
      res.push(category);
      return Promise.resolve(res);
    }

    const children = await SpinalGraphService
      .getChildren(
        id,
        [
          SPINAL_TICKET_SERVICE_CATEGORY_RELATION_NAME,
          SPINAL_TICKET_SERVICE_CATEGORY_SUB_SECTION_RELATION_NAME,
        ]);

    if (typeof children === 'undefined' || children.length === 0) {
      res.push(category);
      return Promise.resolve(res);
    }

    const promises = [];

    for (let i = 0; i < children.length; i = i + 1) {
      promises.push(this.getCategories(children[i].id.get(), []));
    }

    return Promise.all(promises)
      .then((promisesRes) => {
        for (const children of promisesRes) {
          category.children.push(...children);
        }
        res.push(category);
        return Promise.resolve(res);
      });
  }

  private initVar(contextId: string): Promise<void> {
    this.contextId = contextId;
    this.processes = new Set();
    this.processNames = new Set();
    this.steps = new Set();
    this.tickets = new Set();
    this.stepByProcess = new Map();
    this.ticketByStep = new Map();
    this.processByStep = new Map();
    return SpinalGraphService.getChildrenInContext(this.contextId, contextId)
      .then(
        (children) => {

          for (let i = 0; i < children.length; i = i + 1) {
            const child = children[i];
            this.processNames.add(child.name.get());
            this.processes.add(child.id.get());
          }

          this.initialized = true;
          return this.retrieveStep();
        },
      )
      .catch((e) => {
      });
  }

  private retrieveStep(): Promise<void> {
    const promises: Promise<any[]>[] = [];
    for (const processId of this.processes) {
      promises.push(SpinalGraphService
        .getChildren(processId,
          [SPINAL_TICKET_SERVICE_STEP_RELATION_NAME]));
    }
    return Promise.all(promises)
      .then((res) => {
        for (const children of res) {
          for (const child of children) {
            this.steps.add(child.id.get());
            this.addStepToProcess(child.id.get(), child.processId.get());
            this.processByStep.set(child.id.get(), child.processId.get());
          }
        }
      });
  }

  private addStepToProcess(stepId: string, processId: string): boolean {
    let steps = [];
    if (!this.steps.has(stepId) || !this.processes.has(processId)) {
      return false;
    }

    this.processByStep.set(stepId, processId);
    SpinalGraphService.modifyNode(stepId, {processId});

    if (this.stepByProcess.has(processId)) {
      steps = this.stepByProcess.get(processId);

      if (steps.indexOf(stepId) !== -1) {
        return false;
      }

      steps.push(stepId);
      this.stepByProcess.set(processId, steps);
      return true;
    }

    this.stepByProcess.set(processId, [stepId]);
    return true;
  }

  private addTicketToStep(ticketId, stepId): boolean {
    let tickets = [];
    if (!this.tickets.has(ticketId) || !this.steps.has(stepId)) {
      return false;
    }
    const step = SpinalGraphService.getNode(stepId);
    SpinalGraphService.modifyNode(ticketId, {stepId, color: step['color']});
    if (this.ticketByStep.has(stepId)) {
      tickets = this.ticketByStep.get(stepId);
      if (tickets.indexOf(stepId) !== -1) {
        return false;
      }
      tickets.push(stepId);
      this.ticketByStep.set(stepId, tickets);
      return true;
    }

    this.ticketByStep.set(stepId, [ticketId]);
    return true;
  }

  private addTicketToProcessTicketSection(stepId: string, ticketId: string) {
    const processId = this.processByStep.get(stepId);
    SpinalGraphService.modifyNode(ticketId, {stepId, processId});
    return SpinalGraphService
      .getChildren(processId, [SPINAL_TICKET_SERVICE_TICKET_SECTION_RELATION_NAME])
      .then((children) => {
        return SpinalGraphService
          .addChild(children[0].id.get(), ticketId,
            PROCESS_HAS_TICKET_RELATION_NAME,
            PROCESS_HAS_TICKET_RELATION_TYPE);
      });
  }

  private createContext(): Promise<any | Error> {
    return SpinalGraphService.addContext(SERVICE_NAME, SERVICE_TYPE, undefined)
      .then((context) => {
        this.context = context;
        this.contextId = context.info.id.get();
        return this.initVar(context.info.id.get())
          .then(() => {
            return Promise.resolve(context);

          });
      })
      .catch((e) => {
        console.error(e);
        return Promise.reject(Error(CANNOT_CREATE_CONTEXT_INTERNAL_ERROR));
      });
  }

  private addSentenceSection(processId: string): Promise<boolean | string> {
    if (!this.processes.has(processId)) {
      throw new Error(PROCESS_ID_DOES_NOT_EXIST);
    }
    return SpinalGraphService
      .getChildren(processId,
        [SPINAL_TICKET_SERVICE_CATEGORY_SECTION_RELATION_NAME])
      .then((children) => {
        if (children.length > 0) {
          return Promise.reject(DEFAULT_SENTENCE_SECTION_ALREADY_EXIST);
        }

        const sentenceId = SpinalGraphService.createNode({
          processId,
          name: DEFAULT_CATEGORY_NAME,
          type: SPINAL_TICKET_SERVICE_CATEGORY_SECTION_TYPE,
        });

        return SpinalGraphService
          .addChildInContext(
            processId, sentenceId,
            this.contextId,
            SPINAL_TICKET_SERVICE_CATEGORY_SECTION_RELATION_NAME,
            SPINAL_TICKET_SERVICE_CATEGORY_SECTION_RELATION_TYPE)
          .then((e) => {
            return Promise.resolve(true);
          })
          .catch((e) => {
            return Promise.reject(e);
          });
      });
  }

  private addTicketSection(processId: string): Promise<boolean | Error> {
    if (!this.processes.has(processId)) {
      throw new Error(PROCESS_ID_DOES_NOT_EXIST);
    }
    return SpinalGraphService
      .getChildren(processId,
        [SPINAL_TICKET_SERVICE_TICKET_SECTION_RELATION_NAME])
      .then((children) => {
        if (children.length > 0) {
          return Promise.reject(TICKET_SECTION_ALREADY_EXIST);
        }

        const ticketsId = SpinalGraphService.createNode(
          {
            name: 'Tickets',
            type: SPINAL_TICKET_SERVICE_TICKET_SECTION,
          }, undefined);

        return SpinalGraphService
          .addChildInContext(
            processId, ticketsId,
            this.contextId,
            SPINAL_TICKET_SERVICE_TICKET_SECTION_RELATION_NAME,
            SPINAL_TICKET_SERVICE_TICKET_SECTION_RELATION_TYPE)
          .then((e) => {
            return Promise.resolve(true);
          })
          .catch((e) => {
            return Promise.reject(e);
          });
      });
  }

  private initProcess(processId: string): Promise<(boolean | Error)[]> {
    const steps: string[] = this.createDefaultSteps();
    const promises: Promise<boolean | Error>[] = [];

    SpinalGraphService.modifyNode(processId, {defaultStepId: steps[0]});
    promises.push(this.addTicketSection(processId));

    for (const stepId of steps) {
      promises.push(this.addStep(stepId, processId));
    }

    return Promise.all(promises);
  }

  private createDefaultSteps(): string[] {
    const steps = [];
    for (let i = 0; i < DEFAULT_STEPS.length; i = i + 1) {
      const step = DEFAULT_STEPS[i];
      steps.push(this.createStep(step.name, step.color));
    }
    return steps;
  }

}
