import * as React from 'react';

import { connect } from './connect';
import {
  FormikProps,
  GenericFieldHTMLAttributes,
  FormikContext,
  FormikHandlers,
} from './types';
import warning from 'tiny-warning';
import { getIn, isEmptyChildren, isFunction } from './utils';

/**
 * Note: These typings could be more restrictive, but then it would limit the
 * reusability of custom <Field/> components.
 *
 * @example
 * interface MyProps {
 *   ...
 * }
 *
 * export const MyInput: React.SFC<MyProps & FieldProps> = ({
 *   field,
 *   form,
 *   ...props
 * }) =>
 *   <div>
 *     <input {...field} {...props}/>
 *     {form.touched[field.name] && form.errors[field.name]}
 *   </div>
 */
export interface FieldProps<V = any> {
  field: {
    /** Classic React change handler, keyed by input name */
    onChange: FormikHandlers['handleChange'];
    /** Mark input as touched */
    onBlur: FormikHandlers['handleBlur'];
    /** Value of the input */
    value: any;
    /* name of the input */
    name: string;
  };
  form: FormikProps<V>; // if ppl want to restrict this for a given form, let them.
}

export interface FieldConfig {
  /**
   * Field component to render. Can either be a string like 'select' or a component.
   */
  component?:
    | string
    | React.ComponentType<FieldProps<any>>
    | React.ComponentType<void>;

  /**
   * Render prop (works like React router's <Route render={props =>} />)
   */
  render?: ((props: FieldProps<any>) => React.ReactNode);

  /**
   * Children render function <Field name>{props => ...}</Field>)
   */
  children?: ((props: FieldProps<any>) => React.ReactNode) | React.ReactNode;

  /**
   * Validate a single field value independently
   */
  validate?: ((value: any) => string | Promise<void> | undefined);

  /**
   * Field name
   */
  name: string;

  /** HTML input type */
  type?: string;

  /** Field value */
  value?: any;

  /** Inner ref */
  innerRef?: (instance: any) => void;
}

export type FieldAttributes<T> = GenericFieldHTMLAttributes & FieldConfig & T;

/**
 * Custom Field component for quickly hooking into Formik
 * context and wiring up forms.
 */
class FieldInner<Values = {}, Props = {}> extends React.Component<
  FieldAttributes<Props> & { formik: FormikContext<Values> },
  {}
> {
  constructor(
    props: FieldAttributes<Props> & { formik: FormikContext<Values> }
  ) {
    super(props);
    const { render, children, component } = props;
    warning(
      !(component && render),
      'You should not use <Field component> and <Field render> in the same <Field> component; <Field component> will be ignored'
    );

    warning(
      !(component && children && isFunction(children)),
      'You should not use <Field component> and <Field children> as a function in the same <Field> component; <Field component> will be ignored.'
    );

    warning(
      !(render && children && !isEmptyChildren(children)),
      'You should not use <Field render> and <Field children> in the same <Field> component; <Field children> will be ignored'
    );
  }

  componentDidMount() {
    // Register the Field with the parent Formik. Parent will cycle through
    // registered Field's validate fns right prior to submit
    this.props.formik.registerField(this.props.name, this);
  }

  componentDidUpdate(
    prevProps: FieldAttributes<Props> & { formik: FormikContext<Values> }
  ) {
    if (this.props.name !== prevProps.name) {
      this.props.formik.unregisterField(prevProps.name);
      this.props.formik.registerField(this.props.name, this);
    }

    if (this.props.validate !== prevProps.validate) {
      this.props.formik.registerField(this.props.name, this);
    }
  }

  componentWillUnmount() {
    this.props.formik.unregisterField(this.props.name);
  }

  render() {
    const {
      validate,
      name,
      render,
      children,
      component = 'input',
      formik,
      ...props
    } = (this.props as FieldAttributes<Props> & {
      formik: FormikContext<Values>;
    }) as any;
    const {
      validate: _validate,
      validationSchema: _validationSchema,
      ...restOfFormik
    } = formik;
    const field = {
      value:
        props.type === 'radio' || props.type === 'checkbox'
          ? props.value // React uses checked={} for these inputs
          : getIn(formik.values, name),
      name,
      onChange: formik.handleChange,
      onBlur: formik.handleBlur,
    };
    const bag = { field, form: restOfFormik };

    if (render) {
      return (render as any)(bag);
    }

    if (isFunction(children)) {
      return (children as (props: FieldProps<any>) => React.ReactNode)(bag);
    }

    if (typeof component === 'string') {
      const { innerRef, ...rest } = props;
      return React.createElement(component as any, {
        ref: innerRef,
        ...field,
        ...rest,
        children,
      });
    }

    return React.createElement(component as any, {
      ...bag,
      ...props,
      children,
    });
  }
}

export const Field = connect<FieldAttributes<any>, any>(FieldInner);
